import { CartService } from "./cart.service.js";
import { ForbiddenDomainError, ValidationDomainError } from "../../core/errors/domain-error.js";

function buildService(cart: Record<string, unknown> | null) {
  const carts = {
    findById: jest.fn().mockResolvedValue(cart),
    createGuest: jest.fn(),
    findByGuestTokenHash: jest.fn(),
    addItem: jest.fn(),
  };
  const configurator = { validate: jest.fn().mockResolvedValue({ valid: true, issues: [], recommendations: [], price: { subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0, currency: "EUR", breakdown: [] }, estimatedLeadTimeDays: { min: 1, max: 2 } }) };
  const catalog = { findServicesByIds: jest.fn().mockResolvedValue([]), findOptionsByIds: jest.fn().mockResolvedValue([]), getDeviceModelName: jest.fn().mockResolvedValue("Modele"), getDeviceVariantName: jest.fn().mockResolvedValue("Variante") };
  const organizations = { assertActiveApprovedMember: jest.fn().mockResolvedValue(undefined) };
  const tokens = { hashOpaqueToken: jest.fn((raw: string) => `hash-of-${raw}`), generateOpaqueToken: jest.fn().mockReturnValue("raw") };

  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test */
  return new CartService(carts as any, configurator as any, catalog as any, organizations as any, tokens as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

describe("CartService — controle d'appartenance du panier", () => {
  it("empeche un utilisateur d'acceder au panier d'un autre utilisateur authentifie", async () => {
    const service = buildService({ id: "cart-1", userId: "user-A", companyId: null, guestTokenHash: null, convertedAt: null, expiresAt: null, items: [] });
    await expect(service.getCart("cart-1", { userId: "user-B" })).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("autorise le proprietaire du panier authentifie", async () => {
    const service = buildService({ id: "cart-1", userId: "user-A", companyId: null, guestTokenHash: null, convertedAt: null, expiresAt: null, items: [] });
    await expect(service.getCart("cart-1", { userId: "user-A" })).resolves.toBeDefined();
  });

  it("empeche l'acces a un panier invite sans le jeton correspondant", async () => {
    const service = buildService({ id: "cart-1", userId: null, companyId: null, guestTokenHash: "hash-of-correct-token", convertedAt: null, expiresAt: null, items: [] });
    await expect(service.getCart("cart-1", { guestTokenRaw: "wrong-token" })).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("autorise l'acces a un panier invite avec le bon jeton", async () => {
    const service = buildService({ id: "cart-1", userId: null, companyId: null, guestTokenHash: "hash-of-correct-token", convertedAt: null, expiresAt: null, items: [] });
    await expect(service.getCart("cart-1", { guestTokenRaw: "correct-token" })).resolves.toBeDefined();
  });

  it("refuse l'acces a un panier deja converti en commande", async () => {
    const service = buildService({ id: "cart-1", userId: "user-A", companyId: null, guestTokenHash: null, convertedAt: new Date(), expiresAt: null, items: [] });
    await expect(service.getCart("cart-1", { userId: "user-A" })).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("refuse l'acces a un panier expire", async () => {
    const service = buildService({ id: "cart-1", userId: "user-A", companyId: null, guestTokenHash: null, convertedAt: null, expiresAt: new Date(Date.now() - 1000), items: [] });
    await expect(service.getCart("cart-1", { userId: "user-A" })).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("verifie l'appartenance active et approuvee pour un panier d'entreprise", async () => {
    const service = buildService({ id: "cart-1", userId: null, companyId: "company-1", guestTokenHash: null, convertedAt: null, expiresAt: null, items: [] });
    await expect(service.getCart("cart-1", { userId: "user-A" })).resolves.toBeDefined();
  });
});
