process.env.ACCESS_TOKEN_SECRET ??= "test-only-access-token-secret-not-for-production-use";

jest.mock("@smc/database", () => ({
  getPrismaClient: () => ({ $transaction: jest.fn() }),
}));

import { AuthService } from "./auth.service.js";
import { ForbiddenDomainError } from "../../core/errors/domain-error.js";

function buildService(overrides: {
  existingSession?: { id: string; userId: string; familyId: string; expiresAt: Date } | null;
  rotationOutcome?: "ROTATED" | "REUSE_DETECTED" | "NOT_FOUND";
  user?: { id: string; isActive: boolean; accountType: string } | null;
}) {
  const users = {
    findById: jest.fn().mockResolvedValue(overrides.user ?? { id: "user-1", isActive: true, accountType: "INDIVIDUAL" }),
  };
  const sessions = {
    findAnyByHash: jest.fn().mockResolvedValue(overrides.existingSession ?? null),
    rotateIfActive: jest.fn().mockResolvedValue(
      overrides.rotationOutcome === "REUSE_DETECTED"
        ? { outcome: "REUSE_DETECTED" }
        : overrides.rotationOutcome === "NOT_FOUND"
          ? { outcome: "NOT_FOUND" }
          : { outcome: "ROTATED", session: { id: "session-2", userId: "user-1" } },
    ),
    revokeFamily: jest.fn().mockResolvedValue({ count: 3 }),
  };
  const verificationTokens = {};
  const passwords = {};
  const tokens = {
    hashOpaqueToken: jest.fn((raw: string) => `hash-of-${raw}`),
    generateOpaqueToken: jest.fn().mockReturnValue("new-raw-token"),
    signAccessToken: jest.fn().mockReturnValue("signed-access-token"),
    refreshTokenTtlMs: 1000,
  };
  const outbox = {};
  const audit = { record: jest.fn() };

  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test */
  return new AuthService(users as any, sessions as any, verificationTokens as any, passwords as any, tokens as any, outbox as any, audit as any);
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

describe("AuthService.refresh — rotation et detection de reutilisation", () => {
  const meta = { correlationId: "corr-1" };

  it("renouvelle la session lorsque la rotation reussit", async () => {
    const service = buildService({
      existingSession: { id: "session-1", userId: "user-1", familyId: "family-1", expiresAt: new Date(Date.now() + 10_000) },
      rotationOutcome: "ROTATED",
    });
    const result = await service.refresh("raw-refresh-token", meta);
    expect(result.accessToken).toBe("signed-access-token");
  });

  it("revoque toute la famille de sessions en cas de reutilisation detectee", async () => {
    const service = buildService({
      existingSession: { id: "session-1", userId: "user-1", familyId: "family-1", expiresAt: new Date(Date.now() + 10_000) },
      rotationOutcome: "REUSE_DETECTED",
    });
    await expect(service.refresh("raw-refresh-token", meta)).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("refuse un jeton de rafraichissement expire", async () => {
    const service = buildService({
      existingSession: { id: "session-1", userId: "user-1", familyId: "family-1", expiresAt: new Date(Date.now() - 10_000) },
    });
    await expect(service.refresh("raw-refresh-token", meta)).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("refuse un jeton de rafraichissement totalement inconnu", async () => {
    const service = buildService({ existingSession: null });
    await expect(service.refresh("raw-refresh-token", meta)).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("refuse le rafraichissement pour un compte desactive", async () => {
    const service = buildService({
      existingSession: { id: "session-1", userId: "user-1", familyId: "family-1", expiresAt: new Date(Date.now() + 10_000) },
      rotationOutcome: "ROTATED",
      user: { id: "user-1", isActive: false, accountType: "INDIVIDUAL" },
    });
    await expect(service.refresh("raw-refresh-token", meta)).rejects.toBeInstanceOf(ForbiddenDomainError);
  });
});
