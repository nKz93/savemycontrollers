/**
 * Test HTTP reel (Supertest) sur l'application NestJS complete, avec
 * @smc/database mocke (meme approche que app.bootstrap.spec.ts) pour
 * rester executable dans un environnement sans PostgreSQL ni moteur
 * Prisma genere. Verifie des comportements HTTP de bout en bout qui ne
 * dependent pas du contenu reel de la base : healthcheck public minimal,
 * rejet CSRF, verification d'origine.
 */
process.env.ACCESS_TOKEN_SECRET ??= "test-only-access-token-secret-not-for-production-use";
process.env.CSRF_SECRET ??= "test-only-csrf-secret-not-for-production-use";
process.env.CORS_ALLOWED_ORIGINS ??= "http://localhost:3000";

jest.mock("@smc/database", () => {
  function createFakeDelegate(): Record<string, jest.Mock> {
    const delegate: Record<string, jest.Mock> = {};
    for (const method of ["findUnique", "findUniqueOrThrow", "findFirst", "findMany", "create", "update", "updateMany", "upsert", "delete", "deleteMany", "count"]) {
      delegate[method] = jest.fn().mockResolvedValue(null);
    }
    delegate.findMany.mockResolvedValue([]);
    return delegate;
  }
  const modelNames = [
    "user", "session", "emailVerificationToken", "passwordResetToken", "permission", "role",
    "rolePermission", "userRole", "company", "companyMember", "address", "auditLog", "setting",
    "settingHistory", "fileAsset", "brand", "productFamily", "deviceModel", "deviceVariant",
    "hardwareRevision", "serviceCategory", "service", "serviceOption", "servicePack",
    "servicePackItem", "supplier", "part", "partVariant", "mediaAsset", "warrantyPolicy",
    "compatibilityRule", "requirementRule", "exclusionRule", "recommendationRule", "pricingRule",
    "volumeDiscountRule", "companyPricingOverride", "leadTimeRule", "servicePartRequirement",
    "cart", "cartItem", "cartItemService", "cartItemOption", "order", "orderItem",
    "orderItemServiceSnapshot", "orderItemOptionSnapshot", "repairStatusDefinition",
    "repairStatusTransition", "repairCase", "repairStatusHistory", "repairNote", "repairCaseFile",
    "warrantyClaim", "outboxEvent", "extensionManifest", "extensionEventLog",
  ];
  const fakePrisma: Record<string, unknown> = {
    $transaction: jest.fn(async (arg: unknown) => (typeof arg === "function" ? arg(fakePrisma) : Promise.all(arg as Promise<unknown>[]))),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  for (const name of modelNames) fakePrisma[name] = createFakeDelegate();
  return { getPrismaClient: () => fakePrisma };
});

import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import cookieParser from "cookie-parser";
import { HttpExceptionFilter } from "./modules/core/http/http-exception.filter.js";
import { createOriginCheckMiddleware } from "./modules/core/security/origin-check.middleware.js";

describe("Application HTTP (Supertest, @smc/database mocke)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { AppModule } = await import("./app.module.js");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    // Repliqué depuis main.ts : ce middleware est applique imperativement
    // au bootstrap reel (hors du systeme de modules Nest), donc absent
    // par defaut d'une TestingModule — on le reapplique ici explicitement
    // pour tester le comportement HTTP reel.
    app.use(createOriginCheckMiddleware(["http://localhost:3000"]));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /health renvoie un statut minimal sans details d'infrastructure", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);
    expect(response.body).toEqual(expect.objectContaining({ status: "ok" }));
    // Le healthcheck public ne doit jamais reveler l'etat de PostgreSQL/Redis (voir ADR sur la separation health public/interne).
    expect(response.body.checks).toBeUndefined();
  });

  it("GET /internal/health sans authentification est refuse (401)", async () => {
    await request(app.getHttpServer()).get("/internal/health").expect(401);
  });

  it("POST /auth/login sans en-tete Origin autorise est accepte (aucun Origin fourni = pas de navigateur)", async () => {
    // Rappel de la strategie : l'absence d'Origin/Referer ne bloque pas
    // (outils non-navigateur), c'est une Origin PRESENTE mais non
    // autorisee qui est bloquee (voir test suivant).
    const response = await request(app.getHttpServer()).post("/auth/login").send({ email: "not-an-email", password: "" });
    expect(response.status).not.toBe(403);
  });

  it("une requete mutative avec une Origin non autorisee est rejetee (403)", async () => {
    await request(app.getHttpServer())
      .post("/auth/login")
      .set("Origin", "https://site-malveillant.example")
      .send({ email: "test@test.local", password: "whatever12345" })
      .expect(403);
  });

  it("une requete mutative avec une Origin autorisee n'est pas bloquee par le controle d'origine", async () => {
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .set("Origin", "http://localhost:3000")
      .send({ email: "test@test.local", password: "whatever12345" });
    expect(response.status).not.toBe(403);
  });
});
