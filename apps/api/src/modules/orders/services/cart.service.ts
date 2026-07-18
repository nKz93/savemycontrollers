import { Injectable } from "@nestjs/common";
import { CartRepository } from "../repositories/cart.repository.js";
import { ConfiguratorPublicApi } from "../../configurator/configurator.public-api.js";
import { CatalogPublicApi } from "../../catalog/catalog.public-api.js";
import { OrganizationsPublicApi } from "../../organizations/organizations.public-api.js";
import { TokenService } from "../../identity/services/token.service.js";
import { ForbiddenDomainError, NotFoundDomainError, ValidationDomainError } from "../../core/errors/domain-error.js";
import type { AddCartItemRequest, CartDto } from "@smc/contracts";

export interface CartActor {
  userId?: string;
  companyId?: string;
  guestTokenRaw?: string;
}

export interface GuestCartHandle {
  cartId: string;
  newGuestTokenRaw?: string; // present uniquement si un nouveau panier invite a ete cree
}

/**
 * Un UUID de panier seul ne constitue jamais une autorisation suffisante
 * (voir section 10 du prompt). Trois cas :
 *  - panier authentifie : `cart.userId === actor.userId` obligatoire ;
 *  - panier entreprise : appartenance active + approuvee verifiee via
 *    OrganizationsPublicApi ;
 *  - panier invite : le jeton opaque brut (transmis par cookie signe cote
 *    controleur) doit hacher vers `cart.guestTokenHash`.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly carts: CartRepository,
    private readonly configurator: ConfiguratorPublicApi,
    private readonly catalog: CatalogPublicApi,
    private readonly organizations: OrganizationsPublicApi,
    private readonly tokens: TokenService,
  ) {}

  async resolveOrCreateGuestCart(existingGuestTokenRaw?: string): Promise<GuestCartHandle> {
    if (existingGuestTokenRaw) {
      const hash = this.tokens.hashOpaqueToken(existingGuestTokenRaw);
      const cart = await this.carts.findByGuestTokenHash(hash);
      if (cart && !cart.convertedAt && (!cart.expiresAt || cart.expiresAt > new Date())) {
        return { cartId: cart.id };
      }
      // Jeton invalide, expire, ou panier deja converti : un nouveau
      // panier invite est cree plutot que d'echouer silencieusement.
    }
    const rawToken = this.tokens.generateOpaqueToken();
    const cart = await this.carts.createGuest(this.tokens.hashOpaqueToken(rawToken));
    return { cartId: cart.id, newGuestTokenRaw: rawToken };
  }

  private async assertOwnership(cart: { userId: string | null; companyId: string | null; guestTokenHash: string | null; convertedAt: Date | null; expiresAt: Date | null }, actor: CartActor): Promise<void> {
    if (cart.convertedAt) {
      throw new ValidationDomainError("Ce panier a deja ete converti en commande.");
    }
    if (cart.expiresAt && cart.expiresAt < new Date()) {
      throw new ValidationDomainError("Ce panier a expire.");
    }
    if (cart.userId) {
      if (!actor.userId || cart.userId !== actor.userId) {
        throw new ForbiddenDomainError("Ce panier ne vous appartient pas.");
      }
      return;
    }
    if (cart.companyId) {
      if (!actor.userId) throw new ForbiddenDomainError("Authentification requise pour ce panier professionnel.");
      await this.organizations.assertActiveApprovedMember(cart.companyId, actor.userId);
      return;
    }
    if (cart.guestTokenHash) {
      if (!actor.guestTokenRaw || this.tokens.hashOpaqueToken(actor.guestTokenRaw) !== cart.guestTokenHash) {
        throw new ForbiddenDomainError("Acces refuse a ce panier.");
      }
      return;
    }
    throw new ForbiddenDomainError("Acces refuse a ce panier.");
  }

  async addItem(cartId: string, input: Omit<AddCartItemRequest, "cartId">, actor: CartActor): Promise<CartDto> {
    const cart = await this.carts.findById(cartId);
    if (!cart) throw new NotFoundDomainError("Panier introuvable.");
    await this.assertOwnership(cart, actor);

    const trustedCompanyId = cart.companyId ?? undefined;
    const validation = await this.configurator.validate(
      {
        deviceModelId: input.deviceModelId,
        deviceVariantId: input.deviceVariantId,
        hardwareRevisionId: input.hardwareRevisionId,
        serviceIds: input.serviceIds,
        optionIds: input.optionIds,
      },
      trustedCompanyId,
    );
    if (!validation.valid) {
      throw new ValidationDomainError("Configuration invalide.", { issues: validation.issues });
    }

    await this.carts.addItem({
      cartId,
      deviceModelId: input.deviceModelId,
      deviceVariantId: input.deviceVariantId,
      hardwareRevisionId: input.hardwareRevisionId,
      reportedIssue: input.reportedIssue,
      serviceIds: input.serviceIds,
      optionIds: input.optionIds,
    });

    return this.getCart(cartId, actor);
  }

  async getCart(cartId: string, actor: CartActor): Promise<CartDto> {
    const cart = await this.carts.findById(cartId);
    if (!cart) throw new NotFoundDomainError("Panier introuvable.");
    await this.assertOwnership(cart, actor);

    const trustedCompanyId = cart.companyId ?? undefined;
    let subtotalMinor = 0;
    let discountMinor = 0;
    let taxMinor = 0;
    const items = [];

    for (const item of cart.items) {
      const serviceIds = item.services.map((s) => s.serviceId);
      const optionIds = item.options.map((o) => o.serviceOptionId);
      const priced = await this.configurator.validate(
        {
          deviceModelId: item.deviceModelId,
          deviceVariantId: item.deviceVariantId,
          hardwareRevisionId: item.hardwareRevisionId ?? undefined,
          serviceIds,
          optionIds,
        },
        trustedCompanyId,
      );
      const serviceEntities = await this.catalog.findServicesByIds(serviceIds);
      const optionEntities = optionIds.length > 0 ? await this.catalog.findOptionsByIds(optionIds) : [];

      subtotalMinor += priced.price.subtotalMinor;
      discountMinor += priced.price.discountMinor;
      taxMinor += priced.price.taxMinor;

      items.push({
        id: item.id,
        deviceModelName: await this.catalog.getDeviceModelName(item.deviceModelId).catch(() => ""),
        deviceVariantName: await this.catalog.getDeviceVariantName(item.deviceModelId, item.deviceVariantId).catch(() => ""),
        serviceNames: serviceEntities.map((s) => s.name),
        optionNames: optionEntities.map((o) => o.name),
        unitPriceMinor: priced.price.subtotalMinor,
        discountMinor: priced.price.discountMinor,
        taxAmountMinor: priced.price.taxMinor,
        totalMinor: priced.price.totalMinor,
        currency: "EUR" as const,
        reportedIssue: item.reportedIssue,
      });
    }

    return {
      id: cart.id,
      items,
      subtotalMinor,
      discountMinor,
      taxMinor,
      totalMinor: subtotalMinor - discountMinor + taxMinor,
      currency: "EUR",
    };
  }
}
