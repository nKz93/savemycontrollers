import { OrderService } from "./order.service.js";
import { ForbiddenDomainError, NotFoundDomainError } from "../../core/errors/domain-error.js";

function buildService(order: Record<string, unknown> | null) {
  const orders = { findById: jest.fn().mockResolvedValue(order), listForUser: jest.fn(), runInTransaction: jest.fn() };
  const carts = {};
  const addresses = {};
  const configurator = {};
  const catalog = {};
  const organizations = {};
  const references = {};
  const repairs = {};
  const outbox = {};

  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test, casts volontaires */
  return new OrderService(
    orders as any, carts as any, addresses as any, configurator as any,
    catalog as any, organizations as any, references as any, repairs as any, outbox as any,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

describe("OrderService.getOrderForUser", () => {
  it("empeche un client de consulter la commande d'un autre client", async () => {
    const service = buildService({ id: "order-1", userId: "user-A" });
    await expect(service.getOrderForUser("order-1", "user-B")).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("autorise le proprietaire de la commande a la consulter", async () => {
    const service = buildService({ id: "order-1", userId: "user-A" });
    await expect(service.getOrderForUser("order-1", "user-A")).resolves.toBeDefined();
  });

  it("leve une erreur 404 si la commande n'existe pas", async () => {
    const service = buildService(null);
    await expect(service.getOrderForUser("inconnue", "user-A")).rejects.toBeInstanceOf(NotFoundDomainError);
  });
});
