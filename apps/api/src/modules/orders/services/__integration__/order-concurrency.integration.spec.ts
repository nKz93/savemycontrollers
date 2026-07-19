/**
 * Test d'integration REEL (PostgreSQL + Prisma reel + graphe NestJS
 * complet resolu via Test.createTestingModule — @smc/database N'EST PAS
 * mocke ici, contrairement a app.bootstrap.spec.ts). Necessite
 * DATABASE_URL_TEST (voir docker-compose.yml et
 * docs/development/getting-started.md).
 *
 * NON EXECUTABLE dans l'environnement sandbox utilise pour developper ce
 * projet (moteur Prisma inaccessible, voir
 * docs/development/prisma-runtime-blocker-proof.txt). Ecrit pour
 * s'executer reellement en CI (DATABASE_URL_TEST y est defini et
 * obligatoire, voir .github/workflows/ci.yml).
 *
 * Comportement d'idempotence EXACT verifie ici (voir OrderService.createOrder) :
 *  - la premiere requete (ou la transaction qui remporte la reclamation
 *    atomique du panier) cree reellement la commande ;
 *  - toute requete concurrente OU repetee ulterieurement sur le meme
 *    panier reçoit la MEME commande (meme id, meme reference), jamais une
 *    erreur et jamais une deuxieme commande ;
 *  - la base ne contient jamais plus d'une commande pour un panier donne,
 *    ni plus d'un dossier de reparation par article de commande.
 */
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import type { TestingModule } from "@nestjs/testing";

const shouldRun = Boolean(process.env.DATABASE_URL_TEST);
const describeIfDb = shouldRun ? describe : describe.skip;

describeIfDb("OrderService.createOrder — concurrence et idempotence reelles (PostgreSQL)", () => {
  let prisma: PrismaClientType;
  let moduleRef: TestingModule;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- type reel resolu dynamiquement plus bas
  let orderService: any;

  beforeAll(async () => {
    process.env.ACCESS_TOKEN_SECRET ??= "test-only-access-token-secret-not-for-production-use";
    process.env.CSRF_SECRET ??= "test-only-csrf-secret-not-for-production-use-32ch";
    process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

    const { getPrismaClient } = await import("@smc/database");
    prisma = getPrismaClient() as PrismaClientType;

    const { Test } = await import("@nestjs/testing");
    const { AppModule } = await import("../../../../app.module.js");
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const { OrderService } = await import("../order.service.js");
    orderService = moduleRef.get(OrderService);
  }, 60_000);

  afterAll(async () => {
    await moduleRef?.close();
    await prisma?.$disconnect();
  });

  async function seedFixture() {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const user = await prisma.user.create({
      data: {
        email: `concurrency-${suffix}@test.local`,
        passwordHash: "not-a-real-hash",
        firstName: "Test",
        lastName: "Concurrency",
        emailVerifiedAt: new Date(),
      },
    });
    const address = await prisma.address.create({
      data: { userId: user.id, recipientName: "Test Concurrency", line1: "1 rue de Test", postalCode: "75000", city: "Paris", country: "FR" },
    });
    const brand = await prisma.brand.create({ data: { slug: `brand-${suffix}`, name: "Marque Test", status: "ACTIVE" } });
    const family = await prisma.productFamily.create({ data: { brandId: brand.id, slug: `famille-${suffix}`, name: "Famille Test", status: "ACTIVE" } });
    const model = await prisma.deviceModel.create({ data: { familyId: family.id, slug: `modele-${suffix}`, name: "Modele Test", status: "ACTIVE" } });
    const variant = await prisma.deviceVariant.create({ data: { deviceModelId: model.id, name: "Variante Test", status: "ACTIVE" } });
    const category = await prisma.serviceCategory.create({ data: { slug: `cat-${suffix}`, name: "Reparation", kind: "REPAIR", status: "ACTIVE" } });
    const service = await prisma.service.create({
      data: { categoryId: category.id, slug: `service-${suffix}`, name: "Correction du drift", status: "ACTIVE", basePriceMinor: 4999 },
    });
    return { user, address, model, variant, service };
  }

  async function createCartWithOneItem(userId: string, model: { id: string }, variant: { id: string }, service: { id: string }) {
    const cart = await prisma.cart.create({ data: { userId } });
    const item = await prisma.cartItem.create({
      data: { cartId: cart.id, deviceModelId: model.id, deviceVariantId: variant.id, reportedIssue: "Stick drift" },
    });
    await prisma.cartItemService.create({ data: { cartItemId: item.id, serviceId: service.id } });
    return cart;
  }

  it("deux creations CONCURRENTES sur le meme panier : une seule commande en base, les deux appels renvoient la MEME commande, aucun doublon de dossier de reparation", async () => {
    const { user, address, model, variant, service } = await seedFixture();
    const cart = await createCartWithOneItem(user.id, model, variant, service);
    const input = { cartId: cart.id, billingAddressId: address.id, shippingAddressId: address.id };

    const results = await Promise.all([
      orderService.createOrder(input, user.id),
      orderService.createOrder(input, user.id),
    ]);

    // Idempotence : les deux reponses designent la MEME commande.
    expect(results[0].id).toBe(results[1].id);
    expect(results[0].reference).toBe(results[1].reference);

    const ordersInDb = await prisma.order.count({ where: { userId: user.id } });
    expect(ordersInDb).toBe(1);

    const cartAfter = await prisma.cart.findUniqueOrThrow({ where: { id: cart.id } });
    expect(cartAfter.convertedToOrderId).toBe(results[0].id);

    // Un seul dossier de reparation par article de commande, jamais deux.
    const repairCases = await prisma.repairCase.findMany({ where: { orderId: results[0].id } });
    expect(repairCases).toHaveLength(1);
    const distinctOrderItemIds = new Set(repairCases.map((rc) => rc.orderItemId));
    expect(distinctOrderItemIds.size).toBe(repairCases.length);
  }, 30_000);

  it("dix tentatives concurrentes sur le meme panier : une seule commande en base, toutes les reponses reussissent avec le meme identifiant", async () => {
    const { user, address, model, variant, service } = await seedFixture();
    const cart = await createCartWithOneItem(user.id, model, variant, service);
    const input = { cartId: cart.id, billingAddressId: address.id, shippingAddressId: address.id };

    const attempts = Array.from({ length: 10 }, () => orderService.createOrder(input, user.id));
    const results = await Promise.all(attempts);

    const distinctOrderIds = new Set(results.map((r) => r.id));
    expect(distinctOrderIds.size).toBe(1);

    const ordersInDb = await prisma.order.count({ where: { userId: user.id } });
    expect(ordersInDb).toBe(1);
  }, 30_000);

  it("une nouvelle soumission APRES la creation (non concurrente, sequentielle) renvoie toujours la meme commande", async () => {
    const { user, address, model, variant, service } = await seedFixture();
    const cart = await createCartWithOneItem(user.id, model, variant, service);
    const input = { cartId: cart.id, billingAddressId: address.id, shippingAddressId: address.id };

    const first = await orderService.createOrder(input, user.id);
    const second = await orderService.createOrder(input, user.id); // repetition tardive, bien apres la premiere

    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);

    const ordersInDb = await prisma.order.count({ where: { userId: user.id } });
    expect(ordersInDb).toBe(1);
  }, 30_000);
});

if (!shouldRun) {
  test.skip("test d'integration ignore : DATABASE_URL_TEST non defini dans cet environnement", () => {
    // volontairement vide
  });
}
