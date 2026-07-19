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
import type { CreateOrderRequest, OrderDetailDto, OrderSummaryDto, OrderAddressSnapshotDto, OrderItemDetailDto } from "@smc/contracts";

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

  async createOrder(input: CreateOrderRequest, userId: string): Promise<OrderDetailDto> {
    const cart = await this.carts.findById(input.cartId);
    if (!cart) throw new NotFoundDomainError("Panier introuvable.");

    // Un panier invite ne peut pas etre transforme directement en commande
    // authentifiee sans rattachement explicite prealable (hors perimetre de
    // cette phase) : on exige ici que le panier appartienne deja a
    // l'utilisateur courant. Verifie AVANT le chemin rapide idempotent
    // ci-dessous, pour qu'un panier d'un autre utilisateur ne puisse
    // jamais reveler l'existence d'une commande via ce raccourci.
    if (cart.userId !== userId) {
      throw new ForbiddenDomainError("Ce panier ne vous appartient pas.");
    }

    // Idempotence (voir section sur la double soumission) : une requete
    // REPETEE (pas seulement concurrente) sur un panier deja converti
    // renvoie la commande deja creee, jamais une erreur. C'est un chemin
    // rapide (optimisation, simple lecture) ; la garantie d'unicite sous
    // concurrence reelle repose sur la reclamation atomique transactionnelle
    // plus bas, pas sur cette verification.
    if (cart.convertedToOrderId) {
      return this.getOrderForUser(cart.convertedToOrderId, userId);
    }

    if (cart.items.length === 0) throw new ValidationDomainError("Le panier est vide.");
    if (cart.expiresAt && cart.expiresAt < new Date()) throw new ValidationDomainError("Ce panier a expire.");

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

    const orderId = await this.orders.runInTransaction(async (tx) => {
      // Reclamation atomique du panier : premiere ecriture de la
      // transaction, conditionnee sur `convertedAt IS NULL`. C'est cette
      // mise a jour conditionnelle (et non la verification anticipee
      // faite plus haut, qui n'est qu'une optimisation de chemin rapide)
      // qui garantit qu'une double soumission concurrente ne peut jamais
      // creer deux commandes : sous PostgreSQL, l'UPDATE de la
      // transaction perdante se BLOQUE tant que la transaction gagnante
      // n'a pas commite (verrou de ligne sur `cart`), puis se re-evalue
      // contre l'etat desormais commite — la commande gagnante est donc
      // garantie deja visible ici, jamais une lecture partielle.
      const claimed = await tx.cart.updateMany({
        where: { id: cart.id, convertedAt: null },
        data: { convertedAt: new Date() },
      });

      if (claimed.count === 0) {
        // Idempotence : renvoie l'identifiant de la commande gagnante,
        // jamais une erreur — que ce soit une vraie course concurrente ou
        // une repetition tardive de la meme requete.
        const existingCart = await tx.cart.findUniqueOrThrow({ where: { id: cart.id } });
        if (!existingCart.convertedToOrderId) {
          // Defense en profondeur : ne devrait jamais arriver (convertedAt
          // et convertedToOrderId sont toujours poses ensemble ci-dessous).
          throw new ValidationDomainError("Ce panier a deja ete transforme en commande, mais elle est introuvable.");
        }
        return existingCart.convertedToOrderId;
      }

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

      await tx.cart.update({ where: { id: cart.id }, data: { convertedToOrderId: createdOrder.id } });

      return createdOrder.id;
    });

    // Que la commande vienne d'etre creee ou qu'elle existait deja
    // (chemin idempotent ci-dessus), on relit systematiquement via le
    // meme mappeur DTO anti-fuite que la consultation normale — jamais un
    // objet Prisma partiel renvoye directement.
    return this.getOrderForUser(orderId, userId);
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

  async getOrderForUser(orderId: string, userId: string): Promise<OrderDetailDto> {
    const order = await this.orders.findByIdForUser(orderId, userId);
    // Meme erreur, que la commande n'existe pas ou appartienne a un autre
    // compte : aucune fuite d'information sur l'existence d'une commande
    // d'un autre client (voir section 5 du prompt).
    if (!order) throw new NotFoundDomainError("Commande introuvable.");
    return toOrderDetailDto(order);
  }

  async listOwnOrders(userId: string): Promise<OrderSummaryDto[]> {
    const orders = await this.orders.listForUser(userId);
    return orders.map(toOrderSummaryDto);
  }
}

// --- Mappers DTO anti-fuite -------------------------------------------
// Liste blanche stricte de champs (voir section 5 du prompt) : aucune
// entite Prisma n'est jamais renvoyee telle quelle a un controleur.

interface OrderRowForSummary {
  id: string;
  reference: string;
  financialStatus: string;
  operationalStatus: string;
  totalMinor: number;
  currency: string;
  createdAt: Date;
  items: unknown[];
}

function toOrderSummaryDto(row: OrderRowForSummary): OrderSummaryDto {
  return {
    id: row.id,
    reference: row.reference,
    financialStatus: row.financialStatus as OrderSummaryDto["financialStatus"],
    operationalStatus: row.operationalStatus as OrderSummaryDto["operationalStatus"],
    totalMinor: row.totalMinor,
    currency: "EUR",
    itemCount: row.items.length,
    createdAt: row.createdAt.toISOString(),
  };
}

interface OrderRowForDetail extends OrderRowForSummary {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  shippingFeeMinor: number;
  billingRecipientName: string;
  billingCompanyName: string | null;
  billingLine1: string;
  billingLine2: string | null;
  billingPostalCode: string;
  billingCity: string;
  billingCountry: string;
  billingPhone: string | null;
  shippingRecipientName: string;
  shippingCompanyName: string | null;
  shippingLine1: string;
  shippingLine2: string | null;
  shippingPostalCode: string;
  shippingCity: string;
  shippingCountry: string;
  shippingPhone: string | null;
  items: Array<{
    id: string;
    deviceModelNameSnapshot: string;
    deviceVariantNameSnapshot: string;
    hardwareRevisionLabelSnapshot: string | null;
    reportedIssueSnapshot: string | null;
    unitPriceMinorSnapshot: number;
    discountMinorSnapshot: number;
    taxAmountMinorSnapshot: number;
    totalMinorSnapshot: number;
    serviceSnapshots: Array<{ nameSnapshot: string; priceMinorSnapshot: number }>;
    optionSnapshots: Array<{ nameSnapshot: string; priceMinorSnapshot: number }>;
  }>;
  repairCases: Array<{ id: string; orderItemId: string | null }>;
}

function toOrderAddressSnapshot(prefix: {
  recipientName: string;
  companyName: string | null;
  line1: string;
  line2: string | null;
  postalCode: string;
  city: string;
  country: string;
  phone: string | null;
}): OrderAddressSnapshotDto {
  return {
    recipientName: prefix.recipientName,
    companyName: prefix.companyName,
    line1: prefix.line1,
    line2: prefix.line2,
    postalCode: prefix.postalCode,
    city: prefix.city,
    country: prefix.country,
    phone: prefix.phone,
  };
}

function toOrderDetailDto(row: OrderRowForDetail): OrderDetailDto {
  const items: OrderItemDetailDto[] = row.items.map((item) => ({
    id: item.id,
    deviceModelName: item.deviceModelNameSnapshot,
    deviceVariantName: item.deviceVariantNameSnapshot,
    hardwareRevisionLabel: item.hardwareRevisionLabelSnapshot,
    reportedIssue: item.reportedIssueSnapshot,
    unitPriceMinor: item.unitPriceMinorSnapshot,
    discountMinor: item.discountMinorSnapshot,
    taxAmountMinor: item.taxAmountMinorSnapshot,
    totalMinor: item.totalMinorSnapshot,
    services: item.serviceSnapshots.map((s) => ({ name: s.nameSnapshot, priceMinor: s.priceMinorSnapshot })),
    options: item.optionSnapshots.map((o) => ({ name: o.nameSnapshot, priceMinor: o.priceMinorSnapshot })),
    repairCaseId: row.repairCases.find((rc) => rc.orderItemId === item.id)?.id ?? null,
  }));

  return {
    id: row.id,
    reference: row.reference,
    financialStatus: row.financialStatus as OrderDetailDto["financialStatus"],
    operationalStatus: row.operationalStatus as OrderDetailDto["operationalStatus"],
    billingAddress: toOrderAddressSnapshot({
      recipientName: row.billingRecipientName,
      companyName: row.billingCompanyName,
      line1: row.billingLine1,
      line2: row.billingLine2,
      postalCode: row.billingPostalCode,
      city: row.billingCity,
      country: row.billingCountry,
      phone: row.billingPhone,
    }),
    shippingAddress: toOrderAddressSnapshot({
      recipientName: row.shippingRecipientName,
      companyName: row.shippingCompanyName,
      line1: row.shippingLine1,
      line2: row.shippingLine2,
      postalCode: row.shippingPostalCode,
      city: row.shippingCity,
      country: row.shippingCountry,
      phone: row.shippingPhone,
    }),
    subtotalMinor: row.subtotalMinor,
    discountMinor: row.discountMinor,
    taxMinor: row.taxMinor,
    shippingFeeMinor: row.shippingFeeMinor,
    totalMinor: row.totalMinor,
    currency: "EUR",
    items,
    createdAt: row.createdAt.toISOString(),
  };
}
