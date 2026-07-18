const auditRecords: Array<{ resourceId: string; action: string }> = [];

jest.mock("@smc/database", () => ({
  getPrismaClient: () => ({
    auditLog: {
      findFirst: jest.fn(({ where }: { where: { resourceId: string; action: string } }) =>
        Promise.resolve(auditRecords.find((r) => r.resourceId === where.resourceId && r.action === where.action) ?? null),
      ),
      create: jest.fn(({ data }: { data: { resourceId: string; action: string } }) => {
        auditRecords.push({ resourceId: data.resourceId, action: data.action });
        return Promise.resolve(data);
      }),
    },
  }),
}));

import { handleOutboxEvent, type OutboxEventLike } from "./outbox-event-handler.js";
import { createLogger } from "@smc/logger";

describe("handleOutboxEvent", () => {
  const logger = createLogger({ serviceName: "test" });

  beforeEach(() => {
    auditRecords.length = 0;
  });

  it("traite un type d'evenement connu sans lever d'erreur", async () => {
    const event: OutboxEventLike = {
      id: "evt-1",
      eventType: "OrderCreated",
      aggregateType: "Order",
      aggregateId: "order-1",
      payload: {},
      payloadEncrypted: false,
      correlationId: "corr-1",
    };

    await expect(handleOutboxEvent(event, logger)).resolves.toBeUndefined();
  });

  it("ne leve pas d'erreur pour un type d'evenement inconnu (log un avertissement)", async () => {
    const event = { eventType: "SomethingUnknown" } as unknown as OutboxEventLike;
    await expect(handleOutboxEvent(event, logger)).resolves.toBeUndefined();
  });

  it("est idempotent : un evenement EmailVerificationRequested deja traite n'est pas rejoue", async () => {
    const event: OutboxEventLike = {
      id: "evt-email-1",
      eventType: "EmailVerificationRequested",
      aggregateType: "User",
      aggregateId: "user-1",
      payload: { email: "test@example.com" },
      payloadEncrypted: false,
      correlationId: "corr-2",
    };

    await handleOutboxEvent(event, logger);
    expect(auditRecords).toHaveLength(1);

    // Rejeu du meme evenement (simulateur de reprise apres crash) : ne
    // doit PAS produire une seconde trace de traitement.
    await handleOutboxEvent(event, logger);
    expect(auditRecords).toHaveLength(1);
  });
});
