/**
 * Generation reelle du document OpenAPI, executee via l'infrastructure de
 * test (seul mecanisme disponible dans cet environnement capable de
 * bootstrap l'application NestJS complete sans le client Prisma genere —
 * voir app.bootstrap.spec.ts pour la meme technique). Ce n'est pas un test
 * de comportement : c'est un script de generation qui echoue si le
 * document ne peut pas etre produit, ce qui reste une garantie utile.
 *
 * Le fichier produit (docs/api/openapi.json) est un artefact reel du
 * contrat HTTP de l'API tel qu'expose par les decorateurs @nestjs/swagger
 * presents sur les controleurs actuels.
 */
process.env.ACCESS_TOKEN_SECRET ??= "test-only-access-token-secret-not-for-production-use";
process.env.CSRF_SECRET ??= "test-only-csrf-secret-not-for-production-use";

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
    "warrantyClaim", "outboxEvent", "extensionManifest", "extensionEventLog", "referenceCounter",
    "orderStatusHistory",
  ];
  const fakePrisma: Record<string, unknown> = {
    $transaction: jest.fn(async (arg: unknown) => (typeof arg === "function" ? arg(fakePrisma) : Promise.all(arg as Promise<unknown>[]))),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  for (const name of modelNames) fakePrisma[name] = createFakeDelegate();
  return {
    getPrismaClient: () => fakePrisma,
    claimOutboxBatchAtomic: jest.fn().mockResolvedValue([]),
    releaseStaleOutboxLocks: jest.fn().mockResolvedValue(0),
    nextReferenceSequence: jest.fn().mockResolvedValue({ year: 2026, value: 1 }),
  };
});

import { Test } from "@nestjs/testing";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

describe("Generation OpenAPI", () => {
  it("produit un document OpenAPI valide a partir des controleurs reels", async () => {
    const { AppModule } = await import("./app.module.js");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const config = new DocumentBuilder()
      .setTitle("SaveMyControllers API")
      .setDescription("Contrat API du monolithe modulaire SaveMyControllers")
      .setVersion("0.1.0")
      .addCookieAuth("smc_access_token")
      .build();
    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths).toBeDefined();
    expect(Object.keys(document.paths).length).toBeGreaterThan(0);

    const outDir = resolve(__dirname, "../../../docs/api");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(resolve(outDir, "openapi.json"), JSON.stringify(document, null, 2));

    await app.close();
  });
});
