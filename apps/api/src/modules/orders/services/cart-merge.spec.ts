import { CartService } from "./cart.service.js";
import { ForbiddenDomainError, ValidationDomainError } from "../../core/errors/domain-error.js";

function buildService(txCartMock: Record<string, jest.Mock>, txCartItemMock: Record<string, jest.Mock> = {}) {
  const carts = {
    runInTransaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { cart: txCartMock, cartItem: txCartItemMock };
      return fn(tx);
    }),
  };
  const configurator = {};
  const catalog = {};
  const organizations = {};
  const tokens = { hashOpaqueToken: jest.fn((raw: string) => `hash(${raw})`) };

  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test */
  const service = new CartService(carts as any, configurator as any, catalog as any, organizations as any, tokens as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { service, carts, tokens };
}

describe("CartService.attachGuestCartToUser — fusion securisee du panier invite", () => {
  it("no-op idempotent si aucun jeton invite n'est fourni (rien a fusionner)", async () => {
    const { service } = buildService({});
    const result = await service.attachGuestCartToUser("user-A", undefined);
    expect(result).toEqual({ cartId: null, merged: false });
  });

  it("no-op idempotent si le jeton ne correspond a aucun panier (deja fusionne lors d'un rejeu, ou jamais valide)", async () => {
    const txCart = { findUnique: jest.fn().mockResolvedValue(null) };
    const { service } = buildService(txCart);
    const result = await service.attachGuestCartToUser("user-A", "raw-token");
    expect(result).toEqual({ cartId: null, merged: false });
  });

  it("refuse la fusion d'un panier deja converti en commande", async () => {
    const txCart = { findUnique: jest.fn().mockResolvedValue({ id: "cart-1", userId: null, convertedAt: new Date() }) };
    const { service } = buildService(txCart);
    await expect(service.attachGuestCartToUser("user-A", "raw-token")).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("rejeu exact (meme utilisateur deja fusionne) : idempotent, ne relance pas la fusion", async () => {
    const txCart = { findUnique: jest.fn().mockResolvedValue({ id: "cart-1", userId: "user-A", convertedAt: null }) };
    const { service } = buildService(txCart);
    const result = await service.attachGuestCartToUser("user-A", "raw-token");
    expect(result).toEqual({ cartId: "cart-1", merged: true });
  });

  it("defense en profondeur : refuse si le panier appartient deja a un AUTRE utilisateur", async () => {
    const txCart = { findUnique: jest.fn().mockResolvedValue({ id: "cart-1", userId: "user-OTHER", convertedAt: null }) };
    const { service } = buildService(txCart);
    await expect(service.attachGuestCartToUser("user-A", "raw-token")).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("cas simple : l'utilisateur n'a pas de panier actif -> le panier invite devient son panier personnel", async () => {
    const txCart = {
      findUnique: jest.fn().mockResolvedValue({ id: "cart-guest", userId: null, convertedAt: null }),
      findFirst: jest.fn().mockResolvedValue(null), // pas de panier existant pour cet utilisateur
      update: jest.fn().mockResolvedValue({ id: "cart-guest" }),
    };
    const { service } = buildService(txCart);
    const result = await service.attachGuestCartToUser("user-A", "raw-token");

    expect(txCart.update).toHaveBeenCalledWith({
      where: { id: "cart-guest" },
      data: { userId: "user-A", guestTokenHash: null, expiresAt: null },
    });
    expect(result).toEqual({ cartId: "cart-guest", merged: true });
  });

  it("l'utilisateur a deja un panier actif : les lignes sont deplacees, le panier invite (vide) est supprime", async () => {
    const txCart = {
      findUnique: jest.fn().mockResolvedValue({ id: "cart-guest", userId: null, convertedAt: null }),
      findFirst: jest.fn().mockResolvedValue({ id: "cart-existing" }),
      delete: jest.fn().mockResolvedValue({}),
    };
    const txCartItem = { updateMany: jest.fn().mockResolvedValue({ count: 2 }) };
    const { service } = buildService(txCart, txCartItem);

    const result = await service.attachGuestCartToUser("user-A", "raw-token");

    expect(txCartItem.updateMany).toHaveBeenCalledWith({ where: { cartId: "cart-guest" }, data: { cartId: "cart-existing" } });
    expect(txCart.delete).toHaveBeenCalledWith({ where: { id: "cart-guest" } });
    expect(result).toEqual({ cartId: "cart-existing", merged: true });
  });

  it("le jeton invite brut n'est jamais utilise comme identifiant direct : seul son hash est compare", async () => {
    const txCart = { findUnique: jest.fn().mockResolvedValue(null) };
    const { service, tokens } = buildService(txCart);
    await service.attachGuestCartToUser("user-A", "raw-secret-token");
    expect(tokens.hashOpaqueToken).toHaveBeenCalledWith("raw-secret-token");
    expect(txCart.findUnique).toHaveBeenCalledWith({ where: { guestTokenHash: "hash(raw-secret-token)" } });
  });
});
