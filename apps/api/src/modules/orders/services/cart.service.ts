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

  /**
   * Equivalent authentifie de resolveOrCreateGuestCart : retrouve le
   * panier actif de l'utilisateur courant (userId provenant exclusivement
   * du JWT) ou en cree un nouveau. Ne prend jamais de cartId en entree.
   */
  async resolveOrCreateUserCart(userId: string): Promise<{ cartId: string }> {
    const existing = await this.carts.findActiveForUser(userId);
    if (existing) return { cartId: existing.id };
    const created = await this.carts.createForUser(userId);
    return { cartId: created.id };
  }

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

  /**
   * Fusion securisee du panier invite lors de la connexion (voir section
   * 3 du prompt). Contrat strict :
   *  - `userId` provient EXCLUSIVEMENT du token JWT courant (jamais du
   *    corps de la requete) — impose par la signature de cette methode ;
   *  - `guestTokenRaw` est le jeton opaque brut lu depuis le cookie
   *    HttpOnly ; aucun cartId n'est jamais accepte en entree ;
   *  - idempotent : rejouer l'appel (jeton deja fusionne, ou absent) est
   *    un no-op silencieux, jamais une erreur ;
   *  - un panier deja converti en commande (`convertedAt` non nul) est
   *    explicitement refuse ;
   *  - si l'utilisateur possede deja un panier actif, les lignes du
   *    panier invite y sont deplacees et le panier invite (vide) est
   *    supprime plutot que laisse dans un etat ambigu.
   */
  async attachGuestCartToUser(userId: string, guestTokenRaw: string | undefined): Promise<{ cartId: string | null; merged: boolean }> {
    if (!guestTokenRaw) {
      return { cartId: null, merged: false };
    }

    const hash = this.tokens.hashOpaqueToken(guestTokenRaw);

    return this.carts.runInTransaction(async (tx) => {
      const guestCart = await tx.cart.findUnique({ where: { guestTokenHash: hash } });
      if (!guestCart) {
        // Jeton deja fusionne (rejeu) ou jamais valide : no-op idempotent,
        // jamais une erreur — un rejeu ne doit pas bloquer la connexion.
        return { cartId: null, merged: false };
      }
      if (guestCart.convertedAt) {
        throw new ValidationDomainError("Ce panier a deja ete converti en commande, il ne peut pas etre fusionne.");
      }
      if (guestCart.userId && guestCart.userId !== userId) {
        // Defense en profondeur : ne devrait jamais arriver puisque le
        // jeton invite hache est mis a null des qu'un panier est attache
        // a un utilisateur (voir plus bas).
        throw new ForbiddenDomainError("Ce panier invite ne peut pas etre fusionne.");
      }
      if (guestCart.userId === userId) {
        // Rejeu exact (meme utilisateur) : idempotent.
        return { cartId: guestCart.id, merged: true };
      }

      const existingUserCart = await tx.cart.findFirst({ where: { userId, convertedAt: null } });

      if (!existingUserCart) {
        const updated = await tx.cart.update({
          where: { id: guestCart.id },
          data: { userId, guestTokenHash: null, expiresAt: null },
        });
        return { cartId: updated.id, merged: true };
      }

      // L'utilisateur a deja un panier actif : les lignes du panier
      // invite y sont deplacees, puis le panier invite (desormais vide)
      // est supprime — jamais laisse dans un etat qui violerait la
      // contrainte d'appartenance exclusive (chk_carts_ownership).
      await tx.cartItem.updateMany({ where: { cartId: guestCart.id }, data: { cartId: existingUserCart.id } });
      await tx.cart.delete({ where: { id: guestCart.id } });
      return { cartId: existingUserCart.id, merged: true };
    });
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
