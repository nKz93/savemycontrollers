import { OrderService } from "./order.service.js";
import { ForbiddenDomainError, NotFoundDomainError, ValidationDomainError } from "../../core/errors/domain-error.js";

function buildOrderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    reference: "SMC-ORD-2026-000001",
    userId: "user-A",
    financialStatus: "AWAITING_PAYMENT",
    operationalStatus: "CREATED",
    totalMinor: 1200,
    subtotalMinor: 1000,
    discountMinor: 0,
    taxMinor: 200,
    shippingFeeMinor: 0,
    currency: "EUR",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    billingRecipientName: "Alice Client",
    billingCompanyName: null,
    billingLine1: "1 rue Test",
    billingLine2: null,
    billingPostalCode: "75000",
    billingCity: "Paris",
    billingCountry: "FR",
    billingPhone: null,
    shippingRecipientName: "Alice Client",
    shippingCompanyName: null,
    shippingLine1: "1 rue Test",
    shippingLine2: null,
    shippingPostalCode: "75000",
    shippingCity: "Paris",
    shippingCountry: "FR",
    shippingPhone: null,
    items: [
      {
        id: "item-1",
        deviceModelNameSnapshot: "PS5 DualSense",
        deviceVariantNameSnapshot: "Standard",
        hardwareRevisionLabelSnapshot: null,
        reportedIssueSnapshot: "Stick drift",
        unitPriceMinorSnapshot: 1000,
        discountMinorSnapshot: 0,
        taxAmountMinorSnapshot: 200,
        totalMinorSnapshot: 1200,
        serviceSnapshots: [{ nameSnapshot: "Remplacement stick", priceMinorSnapshot: 1000 }],
        optionSnapshots: [],
      },
    ],
    repairCases: [{ id: "repair-1", orderItemId: "item-1" }],
    ...overrides,
  };
}

function buildService(overrides: Partial<Record<string, unknown>> = {}) {
  const orders = {
    findById: jest.fn(),
    findByIdForUser: jest.fn(),
    listForUser: jest.fn(),
    runInTransaction: jest.fn(),
    ...overrides,
  };
  const carts = {};
  const addresses = {};
  const configurator = {};
  const catalog = {};
  const organizations = {};
  const references = {};
  const repairs = {};
  const outbox = {};

  /* eslint-disable @typescript-eslint/no-explicit-any -- mocks de test, casts volontaires */
  const service = new OrderService(
    orders as any, carts as any, addresses as any, configurator as any,
    catalog as any, organizations as any, references as any, repairs as any, outbox as any,
  );
  /* eslint-enable @typescript-eslint/no-explicit-any */
  return { service, orders, carts, addresses, configurator, catalog, organizations, references, repairs, outbox };
}

describe("OrderService.getOrderForUser — isolation entre clients", () => {
  it("recherche la commande ET verifie le proprietaire dans le MEME appel (pas de lecture puis verification separee)", async () => {
    const { service, orders } = buildService();
    orders.findByIdForUser.mockResolvedValue(null);

    await expect(service.getOrderForUser("order-1", "user-B")).rejects.toBeInstanceOf(NotFoundDomainError);
    // La verification de propriete est deleguee a la requete elle-meme :
    // on s'assure que le repository est appele avec (id, userId) ensemble,
    // jamais un findById seul suivi d'une comparaison en memoire.
    expect(orders.findByIdForUser).toHaveBeenCalledWith("order-1", "user-B");
    expect(orders.findById).not.toHaveBeenCalled();
  });

  it("renvoie la MEME erreur (404) qu'une commande soit inexistante ou appartienne a un autre client — aucune fuite d'information", async () => {
    const { service, orders } = buildService();
    orders.findByIdForUser.mockResolvedValue(null); // simule aussi bien "n'existe pas" que "appartient a un autre"
    await expect(service.getOrderForUser("order-1", "user-B")).rejects.toBeInstanceOf(NotFoundDomainError);
  });

  it("autorise le proprietaire de la commande a la consulter", async () => {
    const { service, orders } = buildService();
    orders.findByIdForUser.mockResolvedValue(buildOrderRow());
    await expect(service.getOrderForUser("order-1", "user-A")).resolves.toBeDefined();
  });

  it("le DTO de detail ne contient AUCUN champ interne (userId, ids de FK bruts, hash) — liste blanche stricte", async () => {
    const { service, orders } = buildService();
    orders.findByIdForUser.mockResolvedValue(buildOrderRow());
    const dto = await service.getOrderForUser("order-1", "user-A");

    const dtoKeys = Object.keys(dto);
    for (const forbidden of ["userId", "companyId", "billingAddressId", "shippingAddressId", "qrTokenHash"]) {
      expect(dtoKeys).not.toContain(forbidden);
    }
    // Les instantanes d'adresse sont bien la, mais sous forme de sous-objet whitelist, pas l'entite Address brute.
    expect(dto.billingAddress).toEqual({
      recipientName: "Alice Client",
      companyName: null,
      line1: "1 rue Test",
      line2: null,
      postalCode: "75000",
      city: "Paris",
      country: "FR",
      phone: null,
    });
  });

  it("le DTO de liste ne contient pas les lignes completes, juste un compte", async () => {
    const { service, orders } = buildService();
    orders.listForUser.mockResolvedValue([buildOrderRow()]);
    const [summary] = await service.listOwnOrders("user-A");
    expect(summary).not.toHaveProperty("items");
    expect(summary.itemCount).toBe(1);
  });
});

describe("OrderService.createOrder — securite et integrite", () => {
  function buildCreateOrderMocks(overrides: { cart?: Record<string, unknown>; validation?: Record<string, unknown> } = {}) {
    const cart = {
      id: "cart-1",
      userId: "user-A",
      companyId: null,
      convertedToOrderId: null,
      expiresAt: null,
      items: [
        {
          id: "cart-item-1",
          deviceModelId: "model-1",
          deviceVariantId: "variant-1",
          hardwareRevisionId: null,
          reportedIssue: "Stick drift",
          services: [{ serviceId: "service-1" }],
          options: [],
        },
      ],
      ...overrides.cart,
    };

    // Le prix "reellement applique" est TOUJOURS celui renvoye par le
    // configurateur serveur, jamais une valeur transmise par le client
    // (voir section 1 du prompt : "le calcul de prix ignore toute valeur
    // envoyee par le frontend"). createOrderSchema n'a d'ailleurs AUCUN
    // champ de prix — il est structurellement impossible d'en envoyer un.
    const validation = {
      valid: true,
      issues: [],
      price: {
        subtotalMinor: 4200, // valeur "de reference" du serveur, distincte de toute valeur qu'un attaquant pourrait injecter
        discountMinor: 0,
        taxMinor: 840,
        totalMinor: 5040,
        currency: "EUR",
        breakdown: [{ kind: "SERVICE", id: "service-1", name: "Remplacement stick", unitPriceMinor: 4200, currency: "EUR" }],
      },
      ...overrides.validation,
    };

    const { service, orders, carts, addresses, configurator, catalog, references, repairs, outbox } = buildService();
    // Mock par defaut : createOrder relit TOUJOURS via getOrderForUser a la
    // fin (chemin gagnant ou idempotent), donc findByIdForUser doit
    // repondre par defaut ; les tests qui veulent verifier un contenu
    // precis peuvent le redefinir localement.
    orders.findByIdForUser = jest.fn().mockResolvedValue(buildOrderRow({ id: "order-new" }));
    carts.findById = jest.fn().mockResolvedValue(cart);
    addresses.findById = jest.fn().mockResolvedValue({
      id: "addr-1", userId: "user-A", companyId: null,
      recipientName: "Alice", line1: "1 rue Test", line2: null, postalCode: "75000", city: "Paris", country: "FR", phone: null,
    });
    configurator.validate = jest.fn().mockResolvedValue(validation);
    catalog.getDeviceModelName = jest.fn().mockResolvedValue("PS5");
    catalog.getDeviceVariantName = jest.fn().mockResolvedValue("Standard");
    references.generateOrderReference = jest.fn().mockResolvedValue("SMC-ORD-2026-000001");
    repairs.createCasesForOrderInTransaction = jest.fn().mockResolvedValue(undefined);
    outbox.appendInTransaction = jest.fn().mockResolvedValue(undefined);

    return { service, orders, carts, addresses, configurator, catalog, references, repairs, outbox, cart, validation };
  }

  it("utilise EXCLUSIVEMENT le prix calcule par le configurateur serveur, jamais une valeur du client (createOrderSchema n'a aucun champ de prix)", async () => {
    const { service, orders, validation } = buildCreateOrderMocks();

    let capturedOrderCreateData: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    orders.runInTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        cart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
        order: {
          create: jest.fn((args: { data: unknown }) => {
            capturedOrderCreateData = args.data;
            return Promise.resolve({ id: "order-new", reference: "SMC-ORD-2026-000001", items: [{ id: "item-new" }] });
          }),
        },
      };
      return fn(tx);
    });

    await service.createOrder(
      { cartId: "cart-1", billingAddressId: "addr-1", shippingAddressId: "addr-1" },
      "user-A",
    );

    expect(capturedOrderCreateData.totalMinor).toBe(validation.price.totalMinor);
    expect(capturedOrderCreateData.subtotalMinor).toBe(validation.price.subtotalMinor);
    // Aucune trace d'un champ de prix arbitraire provenant de l'entree utilisateur.
    expect(capturedOrderCreateData).not.toHaveProperty("clientProvidedPrice");
  });

  it("rejette la commande si le configurateur invalide une ligne (compatibilite/exclusion/option manquante verifiees cote serveur)", async () => {
    const { service } = buildCreateOrderMocks({
      validation: { valid: false, issues: [{ code: "INCOMPATIBLE", message: "Modele incompatible" }] },
    });
    await expect(
      service.createOrder({ cartId: "cart-1", billingAddressId: "addr-1", shippingAddressId: "addr-1" }, "user-A"),
    ).rejects.toBeInstanceOf(ValidationDomainError);
  });

  it("DOUBLE SOUMISSION / IDEMPOTENCE : si la reclamation atomique echoue (deja converti par une requete concurrente ou repetee), la commande DEJA CREEE est renvoyee, pas une erreur", async () => {
    const { service, orders } = buildCreateOrderMocks();

    const orderCreateMock = jest.fn();
    const existingOrderRow = buildOrderRow({ id: "order-existing" });
    orders.runInTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        cart: {
          // Simule exactement ce qui se passe si une transaction concurrente
          // a deja reclame ce panier entre la lecture initiale et l'entree
          // dans cette transaction : la mise a jour conditionnelle affecte 0 ligne.
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          update: jest.fn(),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: "cart-1", convertedToOrderId: "order-existing" }),
        },
        order: { create: orderCreateMock },
      };
      return fn(tx);
    });
    orders.findByIdForUser = jest.fn().mockResolvedValue(existingOrderRow);

    const result = await service.createOrder(
      { cartId: "cart-1", billingAddressId: "addr-1", shippingAddressId: "addr-1" },
      "user-A",
    );

    // La preuve cle : order.create n'est JAMAIS appele quand la
    // reclamation echoue (aucune deuxieme commande creee), ET la methode
    // renvoie bien la commande DEJA existante, pas une erreur.
    expect(orderCreateMock).not.toHaveBeenCalled();
    expect(result.id).toBe(existingOrderRow.id);
    expect(result.reference).toBe(existingOrderRow.reference);
    expect(orders.findByIdForUser).toHaveBeenCalledWith("order-existing", "user-A");
  });

  it("REPETITION (pas seulement concurrence) : un panier deja converti renvoie directement la commande existante via le chemin rapide, sans repasser par la transaction", async () => {
    const { service, orders } = buildCreateOrderMocks({ cart: { convertedToOrderId: "order-existing" } });
    const existingOrderRow = buildOrderRow({ id: "order-existing" });
    orders.findByIdForUser = jest.fn().mockResolvedValue(existingOrderRow);
    orders.runInTransaction = jest.fn(); // ne doit jamais etre appele sur ce chemin

    const result = await service.createOrder(
      { cartId: "cart-1", billingAddressId: "addr-1", shippingAddressId: "addr-1" },
      "user-A",
    );

    expect(result.id).toBe("order-existing");
    expect(orders.runInTransaction).not.toHaveBeenCalled();
  });

  it("la reclamation du panier est bien la PREMIERE ecriture de la transaction, avant la creation de la commande", async () => {
    const { service, orders } = buildCreateOrderMocks();
    const callOrder: string[] = [];
    orders.runInTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        cart: {
          updateMany: jest.fn(() => { callOrder.push("claim"); return Promise.resolve({ count: 1 }); }),
          update: jest.fn(() => { callOrder.push("finalize"); return Promise.resolve({}); }),
        },
        order: {
          create: jest.fn(() => { callOrder.push("order.create"); return Promise.resolve({ id: "order-new", reference: "R", items: [{ id: "item-new" }] }); }),
        },
      };
      return fn(tx);
    });
    orders.findByIdForUser = jest.fn().mockResolvedValue(buildOrderRow({ id: "order-new" }));

    await service.createOrder({ cartId: "cart-1", billingAddressId: "addr-1", shippingAddressId: "addr-1" }, "user-A");
    expect(callOrder[0]).toBe("claim");
    expect(callOrder.indexOf("claim")).toBeLessThan(callOrder.indexOf("order.create"));
  });

  it("refuse un panier appartenant a un autre utilisateur (pas de vol de panier par manipulation de cartId)", async () => {
    const { service } = buildCreateOrderMocks({ cart: { userId: "user-OTHER" } });
    await expect(
      service.createOrder({ cartId: "cart-1", billingAddressId: "addr-1", shippingAddressId: "addr-1" }, "user-A"),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("refuse une adresse n'appartenant pas a l'utilisateur (pas d'usurpation d'adresse par manipulation d'id)", async () => {
    const { service, addresses } = buildCreateOrderMocks();
    addresses.findById = jest.fn().mockResolvedValue({
      id: "addr-other", userId: "user-OTHER", companyId: null,
      recipientName: "Bob", line1: "X", line2: null, postalCode: "00000", city: "X", country: "FR", phone: null,
    });
    await expect(
      service.createOrder({ cartId: "cart-1", billingAddressId: "addr-other", shippingAddressId: "addr-other" }, "user-A"),
    ).rejects.toBeInstanceOf(ForbiddenDomainError);
  });

  it("instantanes complets : chaque ligne d'article capture nom, prix et details au moment de la commande", async () => {
    const { service, orders } = buildCreateOrderMocks();
    let capturedItemsCreate: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    orders.runInTransaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        cart: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn() },
        order: {
          create: jest.fn((args: { data: { items: { create: unknown } } }) => {
            capturedItemsCreate = args.data.items.create;
            return Promise.resolve({ id: "order-new", reference: "R", items: [{ id: "item-new" }] });
          }),
        },
      };
      return fn(tx);
    });

    await service.createOrder({ cartId: "cart-1", billingAddressId: "addr-1", shippingAddressId: "addr-1" }, "user-A");

    expect(capturedItemsCreate).toHaveLength(1);
    const snapshot = capturedItemsCreate[0];
    expect(snapshot.deviceModelNameSnapshot).toBe("PS5");
    expect(snapshot.deviceVariantNameSnapshot).toBe("Standard");
    expect(snapshot.unitPriceMinorSnapshot).toBe(4200);
    expect(snapshot.serviceSnapshots.create).toHaveLength(1);
    expect(snapshot.serviceSnapshots.create[0]).toEqual({ serviceId: "service-1", nameSnapshot: "Remplacement stick", priceMinorSnapshot: 4200 });
  });
});
