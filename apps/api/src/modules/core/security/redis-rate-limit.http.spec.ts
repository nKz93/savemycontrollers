/**
 * Test HTTP REEL du rate limiting Redis (pas de mock du limiteur) : ce
 * fichier se connecte a une vraie instance Redis locale (voir
 * docker-compose.yml pour l'equivalent en developpement/CI). Contrairement
 * a app.http.spec.ts, @smc/database reste mocke (seule la resolution du
 * graphe DI et le comportement HTTP nous interessent ici), mais Redis est
 * REEL : c'est la seule maniere de prouver honnetement que la limitation
 * de debit distribuee fonctionne, plutot que de la simuler.
 */
process.env.ACCESS_TOKEN_SECRET ??= "test-only-access-token-secret-not-for-production-use";
process.env.CSRF_SECRET ??= "test-only-csrf-secret-not-for-production-use";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:3000";
process.env.REDIS_URL ??= "redis://localhost:6379";

const shouldRun = Boolean(process.env.REDIS_URL);
const describeIfRedis = shouldRun ? describe : describe.skip;

jest.mock("@smc/database", () => {
  function createFakeDelegate(): Record<string, jest.Mock> {
    const delegate: Record<string, jest.Mock> = {};
    for (const method of ["findUnique", "findUniqueOrThrow", "findFirst", "findMany", "create", "update", "updateMany", "upsert", "delete", "deleteMany", "count"]) {
      delegate[method] = jest.fn().mockResolvedValue(null);
    }
    delegate.findMany.mockResolvedValue([]);
    return delegate;
  }
  const modelNames = ["user", "session", "emailVerificationToken", "passwordResetToken", "permission", "role", "rolePermission", "userRole", "company", "companyMember", "address", "auditLog", "setting", "settingHistory", "fileAsset", "brand", "productFamily", "deviceModel", "deviceVariant", "hardwareRevision", "serviceCategory", "service", "serviceOption", "servicePack", "servicePackItem", "supplier", "part", "partVariant", "mediaAsset", "warrantyPolicy", "compatibilityRule", "requirementRule", "exclusionRule", "recommendationRule", "pricingRule", "volumeDiscountRule", "companyPricingOverride", "leadTimeRule", "servicePartRequirement", "cart", "cartItem", "cartItemService", "cartItemOption", "order", "orderItem", "orderItemServiceSnapshot", "orderItemOptionSnapshot", "repairStatusDefinition", "repairStatusTransition", "repairCase", "repairStatusHistory", "repairNote", "repairCaseFile", "warrantyClaim", "outboxEvent", "extensionManifest", "extensionEventLog", "referenceCounter", "orderStatusHistory"];
  const fakePrisma: Record<string, unknown> = {
    $transaction: jest.fn(async (arg: unknown) => (typeof arg === "function" ? arg(fakePrisma) : Promise.all(arg as Promise<unknown>[]))),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  for (const name of modelNames) fakePrisma[name] = createFakeDelegate();
  return { getPrismaClient: () => fakePrisma, claimOutboxBatchAtomic: jest.fn().mockResolvedValue([]), releaseStaleOutboxLocks: jest.fn().mockResolvedValue(0), nextReferenceSequence: jest.fn().mockResolvedValue({ year: 2026, value: 1 }) };
});

import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import IORedis from "ioredis";
import { HttpExceptionFilter } from "../http/http-exception.filter.js";

describeIfRedis("Rate limiting Redis reel sur /auth/login", () => {
  let app: INestApplication;
  let redis: IORedis;

  beforeAll(async () => {
    redis = new IORedis(process.env.REDIS_URL!);
    await redis.flushall();

    const { AppModule } = await import("../../../app.module.js");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await redis.quit();
  });

  it("autorise jusqu'a la limite puis bloque avec 429, pour une IP+email donnes", async () => {
    const email = `ratelimit-test-${Date.now()}@test.local`;
    const results: number[] = [];
    // La limite configuree sur /auth/login est de 10 tentatives / 60s / (IP, email).
    for (let i = 0; i < 12; i++) {
       
      const response = await request(app.getHttpServer()).post("/auth/login").send({ email, password: "whatever12345" });
      results.push(response.status);
    }
    const blockedCount = results.filter((s) => s === 429).length;
    const notBlockedCount = results.filter((s) => s !== 429).length;

    expect(notBlockedCount).toBe(10);
    expect(blockedCount).toBe(2);
  }, 20_000);

  it("une IP+email differents ne sont pas affectes par la limite d'un autre couple", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: `autre-email-${Date.now()}@test.local`, password: "whatever12345" });
    expect(response.status).not.toBe(429);
  });
});

if (!shouldRun) {
  test.skip("test ignore : aucun REDIS_URL disponible dans cet environnement", () => {});
}
