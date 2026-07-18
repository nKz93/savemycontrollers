import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { OrderRepository } from "../repositories/order.repository.js";
import { CartRepository } from "../repositories/cart.repository.js";
import { AddressRepository } from "../repositories/address.repository.js";
import { ConfiguratorPublicApi } from "../../configurator/configurator.public-api.js";
import { CatalogPublicApi } from "../../catalog/catalog.public-api.js";
import { OrganizationsPublicApi } from "../../organizations/organizations.public-api.js";
import { ReferenceGeneratorService } from "../../core/services/reference-generator.service.js";
import { RepairsPublicApi } from "../../repairs/repairs.public-api.js";
import { OutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import { BUSINESS_EVENT_TYPES } from "../../core/events/business-event.js";
import { ForbiddenDomainError, NotFoundDomainError, ValidationDomainError } from "../../core/errors/domain-error.js";
import type { CreateOrderRequest } from "@smc/contracts";

/**
 * Creation de commande : construit un instantane immuable de chaque ligne
 * — y compris les adresses de facturation/expedition, copiees en champs
 * denormalises sur la commande elle-meme (voir section 14 du prompt : une
 * commande ne doit jamais dependre d'une adresse modifiable ulterieurement)
 * — puis cree un dossier de reparation par appareil dans la MEME
 * transaction, et enregistre l'evenement OrderCreated dans l'Outbox
 * toujours dans la meme transaction.
 */
@Injectable()
export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly carts: CartRepository,
    private readonly addresses: AddressRepository,
    private readonly configurator: ConfiguratorPublicApi,
    private readonly catalog: CatalogPublicApi,
    private readonly organizations: OrganizationsPublicApi,
    private readonly references: ReferenceGeneratorService,
    private readonly repairs: RepairsPublicApi,
    private readonly outbox: OutboxRepository,
  ) {}

  async createOrder(input: CreateOrderRequest, userId: string) {
    const cart = await this.carts.findById(input.cartId);
    if (!cart) throw new NotFoundDomainError("Panier introuvable.");
    if (cart.items.length === 0) throw new ValidationDomainError("Le panier est vide.");
    if (cart.convertedToOrderId) throw new ValidationDomainError("Ce panier a deja ete transforme en commande.");
    if (cart.expiresAt && cart.expiresAt < new Date()) throw new ValidationDomainError("Ce panier a expire.");

    // Un panier invite ne peut pas etre transforme directement en commande
    // authentifiee sans rattachement explicite prealable (hors perimetre de
    // cette phase) : on exige ici que le panier appartienne deja a
    // l'utilisateur courant.
    if (cart.userId !== userId) {
      throw new ForbiddenDomainError("Ce panier ne vous appartient pas.");
    }

    let companyId: string | undefined;
    if (cart.companyId) {
      await this.organizations.assertActiveApprovedMember(cart.companyId, userId);
      companyId = cart.companyId;
    }

    const billingAddress = await this.addresses.findById(input.billingAddressId);
    const shippingAddress = await this.addresses.findById(input.shippingAddressId);
    if (!billingAddress || !shippingAddress) throw new NotFoundDomainError("Adresse introuvable.");
    this.assertAddressOwnership(billingAddress, userId, companyId);
    this.assertAddressOwnership(shippingAddress, userId, companyId);

    // Revalidation complete de chaque ligne au moment de la commande
    // (le panier a pu vieillir : stock, prix, compatibilite).
    const pricedItems: Array<{
      item: (typeof cart.items)[number];
      validation: Awaited<ReturnType<ConfiguratorPublicApi["validate"]>>;
      deviceModelName: string;
      deviceVariantName: string;
    }> = [];
    for (const item of cart.items) {
      const serviceIds = item.services.map((s) => s.serviceId);
      const optionIds = item.options.map((o) => o.serviceOptionId);
      const validation = await this.configurator.validate(
        {
          deviceModelId: item.deviceModelId,
          deviceVariantId: item.deviceVariantId,
          hardwareRevisionId: item.hardwareRevisionId ?? undefined,
          serviceIds,
          optionIds,
        },
        companyId,
      );
      if (!validation.valid) {
        throw new ValidationDomainError("Une ligne du panier n'est plus valide.", { issues: validation.issues });
      }
      const deviceModelName = await this.catalog.getDeviceModelName(item.deviceModelId);
      const deviceVariantName = await this.catalog.getDeviceVariantName(item.deviceModelId, item.deviceVariantId);
      pricedItems.push({ item, validation, deviceModelName, deviceVariantName });
    }

    const subtotalMinor = pricedItems.reduce((sum, p) => sum + p.validation.price.subtotalMinor, 0);
    const discountMinor = pricedItems.reduce((sum, p) => sum + p.validation.price.discountMinor, 0);
    const taxMinor = pricedItems.reduce((sum, p) => sum + p.validation.price.taxMinor, 0);
    const totalMinor = subtotalMinor - discountMinor + taxMinor;

    const correlationId = randomUUID();
    const reference = await this.references.generateOrderReference();

    const order = await this.orders.runInTransaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          reference,
          userId,
          companyId,
          billingAddressId: input.billingAddressId,
          shippingAddressId: input.shippingAddressId,
          billingRecipientName: billingAddress.recipientName,
          billingLine1: billingAddress.line1,
          billingLine2: billingAddress.line2,
          billingPostalCode: billingAddress.postalCode,
          billingCity: billingAddress.city,
          billingCountry: billingAddress.country,
          billingPhone: billingAddress.phone,
          shippingRecipientName: shippingAddress.recipientName,
          shippingLine1: shippingAddress.line1,
          shippingLine2: shippingAddress.line2,
          shippingPostalCode: shippingAddress.postalCode,
          shippingCity: shippingAddress.city,
          shippingCountry: shippingAddress.country,
          shippingPhone: shippingAddress.phone,
          subtotalMinor,
          discountMinor,
          taxMinor,
          totalMinor,
          items: {
            create: pricedItems.map(({ item, validation, deviceModelName, deviceVariantName }) => ({
              deviceModelId: item.deviceModelId,
              deviceVariantId: item.deviceVariantId,
              hardwareRevisionId: item.hardwareRevisionId,
              deviceModelNameSnapshot: deviceModelName,
              deviceVariantNameSnapshot: deviceVariantName,
              reportedIssueSnapshot: item.reportedIssue,
              unitPriceMinorSnapshot: validation.price.subtotalMinor,
              discountMinorSnapshot: validation.price.discountMinor,
              taxRateBasisPointsSnapshot: validation.price.subtotalMinor > 0
                ? Math.round((validation.price.taxMinor * 10000) / validation.price.subtotalMinor)
                : 0,
              taxAmountMinorSnapshot: validation.price.taxMinor,
              totalMinorSnapshot: validation.price.totalMinor,
              // Chaque ligne du detail de prix serveur (prestation ou
              // option) devient un instantane distinct — c'est le prix
              // REELLEMENT applique (regle de prix, tarif negocie...), pas
              // Service.basePriceMinor (voir section 14 du prompt).
              serviceSnapshots: {
                create: validation.price.breakdown
                  .filter((line) => line.kind === "SERVICE")
                  .map((line) => ({ serviceId: line.id, nameSnapshot: line.name, priceMinorSnapshot: line.unitPriceMinor })),
              },
              optionSnapshots: {
                create: validation.price.breakdown
                  .filter((line) => line.kind === "OPTION")
                  .map((line) => ({ serviceOptionId: line.id, nameSnapshot: line.name, priceMinorSnapshot: line.unitPriceMinor })),
              },
            })),
          },
          statusHistory: {
            create: { status: "CREATED", changedByUserId: userId, comment: "Commande creee." },
          },
        },
        include: { items: true },
      });

      await this.outbox.appendInTransaction(tx, {
        eventType: BUSINESS_EVENT_TYPES.ORDER_CREATED,
        aggregateType: "Order",
        aggregateId: createdOrder.id,
        payload: { reference: createdOrder.reference, totalMinor },
        correlationId,
      });

      const repairCaseInputs = createdOrder.items.map((orderItem, index) => {
        const priced = pricedItems[index];
        if (!priced) {
          // Ne devrait jamais arriver : les deux tableaux sont construits
          // dans le meme ordre a partir de la meme source (cart.items).
          throw new Error(`Incoherence interne : aucune ligne de prix pour l'index ${index}.`);
        }
        return {
          orderId: createdOrder.id,
          orderItemId: orderItem.id,
          clientId: userId,
          companyId,
          deviceModelId: priced.item.deviceModelId,
          deviceVariantId: priced.item.deviceVariantId,
          hardwareRevisionId: priced.item.hardwareRevisionId ?? undefined,
          reportedIssue: priced.item.reportedIssue ?? undefined,
        };
      });
      await this.repairs.createCasesForOrderInTransaction(tx, repairCaseInputs, correlationId);

      await tx.cart.update({ where: { id: cart.id }, data: { convertedToOrderId: createdOrder.id, convertedAt: new Date() } });

      return createdOrder;
    });

    return order;
  }

  private assertAddressOwnership(address: { userId: string | null; companyId: string | null }, userId: string, companyId?: string): void {
    if (companyId) {
      if (address.companyId !== companyId) throw new ForbiddenDomainError("Cette adresse n'appartient pas a cette entreprise.");
      return;
    }
    if (address.userId !== userId) {
      throw new ForbiddenDomainError("Cette adresse ne vous appartient pas.");
    }
  }

  async getOrderForUser(orderId: string, userId: string) {
    const order = await this.orders.findById(orderId);
    if (!order) throw new NotFoundDomainError("Commande introuvable.");
    if (order.userId !== userId) throw new ForbiddenDomainError("Acces refuse a cette commande.");
    return order;
  }

  async listOwnOrders(userId: string) {
    return this.orders.listForUser(userId);
  }
}
