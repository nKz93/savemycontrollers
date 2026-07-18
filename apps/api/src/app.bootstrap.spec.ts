/**
 * Test de demarrage reel de l'application NestJS. Il verifie que le graphe
 * de dependances complet (tous les modules metier de AppModule) se resout
 * sans erreur — c'est le filet de securite qui aurait immediatement
 * detecte la regression corrigee dans cette phase (des classes injectees
 * importees en `import type`, produisant une metadonnee `design:paramtypes`
 * incorrecte et empechant NestJS de resoudre la dependance).
 *
 * @smc/database est mocke ici : ce test verifie la RESOLUTION DES
 * DEPENDANCES (le graphe DI), pas le comportement de la base de donnees.
 * Cela permet de faire tourner ce test sans PostgreSQL ni moteur Prisma
 * genere, ce qui est necessaire dans cet environnement (voir le rapport de
 * fin de phase sur le blocage reseau de la generation Prisma). Un test
 * d'integration complementaire (avec une vraie base) est prevu separement
 * (voir modules/orders/order-repair-flow.integration.spec.ts).
 */

// Variables minimales necessaires a la CONSTRUCTION des providers (ex.
// TokenService refuse de s'instancier sans ACCESS_TOKEN_SECRET, ce qui est
// le comportement de securite voulu — voir ADR-018). Ce test verifie la
// resolution du graphe de dependances, pas la configuration de production.
process.env.ACCESS_TOKEN_SECRET ??= "test-only-access-token-secret-not-for-production-use";
process.env.CSRF_SECRET ??= "test-only-csrf-secret-not-for-production-use";

import { Test } from "@nestjs/testing";

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
    "user", "session", "emailVerificationToken", "passwordResetToken",
    "permission", "role", "rolePermission", "userRole",
    "company", "companyMember", "address",
    "auditLog", "setting", "settingHistory", "fileAsset",
    "brand", "productFamily", "deviceModel", "deviceVariant", "hardwareRevision",
    "serviceCategory", "service", "serviceOption", "servicePack", "servicePackItem",
    "supplier", "part", "partVariant", "mediaAsset", "warrantyPolicy",
    "compatibilityRule", "requirementRule", "exclusionRule", "recommendationRule",
    "pricingRule", "volumeDiscountRule", "companyPricingOverride", "leadTimeRule",
    "servicePartRequirement", "cart", "cartItem", "cartItemService", "cartItemOption",
    "order", "orderItem", "orderItemServiceSnapshot", "orderItemOptionSnapshot",
    "repairStatusDefinition", "repairStatusTransition", "repairCase",
    "repairStatusHistory", "repairNote", "repairCaseFile", "warrantyClaim",
    "outboxEvent", "extensionManifest", "extensionEventLog",
  ];

  const fakePrisma: Record<string, unknown> = {
    $transaction: jest.fn(async (arg: unknown) => {
      if (typeof arg === "function") return arg(fakePrisma);
      return Promise.all(arg as Promise<unknown>[]);
    }),
    $queryRaw: jest.fn().mockResolvedValue([]),
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };
  for (const name of modelNames) fakePrisma[name] = createFakeDelegate();

  return {
    getPrismaClient: () => fakePrisma,
  };
});

describe("Demarrage de l'application (resolution du graphe de dependances NestJS)", () => {
  it("resout AppModule sans erreur de dependance manquante", async () => {
    const { AppModule } = await import("./app.module.js");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    await app.close();
  });
});
