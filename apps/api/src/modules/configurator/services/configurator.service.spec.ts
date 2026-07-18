import { ConfiguratorService } from "./configurator.service.js";
import type { RulesRepository } from "../repositories/rules.repository.js";
import type { CatalogPublicApi } from "../../catalog/catalog.public-api.js";
import type { SettingsService } from "../../settings/services/settings.service.js";

function buildService(overrides: {
  compatibilityRules?: unknown[];
  exclusionRules?: unknown[];
  requirementRules?: unknown[];
  recommendationRules?: unknown[];
  pricingRules?: unknown[];
  companyOverrides?: unknown[];
  leadTimeRules?: unknown[];
  services?: unknown[];
  options?: unknown[];
  requiredOptions?: unknown[];
  taxRateBasisPoints?: number;
  modelActive?: boolean;
  variantActive?: boolean;
}) {
  const rules = {
    compatibilityRulesForServices: jest.fn().mockResolvedValue(overrides.compatibilityRules ?? []),
    exclusionRulesForServices: jest.fn().mockResolvedValue(overrides.exclusionRules ?? []),
    requirementRulesForServices: jest.fn().mockResolvedValue(overrides.requirementRules ?? []),
    recommendationRulesForServices: jest.fn().mockResolvedValue(overrides.recommendationRules ?? []),
    pricingRulesForServices: jest.fn().mockResolvedValue(overrides.pricingRules ?? []),
    companyOverridesForServices: jest.fn().mockResolvedValue(overrides.companyOverrides ?? []),
    leadTimeRulesForServices: jest.fn().mockResolvedValue(overrides.leadTimeRules ?? []),
  } as unknown as RulesRepository;

  const catalog = {
    isDeviceModelActive: jest.fn().mockResolvedValue(overrides.modelActive ?? true),
    isDeviceVariantActive: jest.fn().mockResolvedValue(overrides.variantActive ?? true),
    isHardwareRevisionValid: jest.fn().mockResolvedValue(true),
    findServicesByIds: jest.fn().mockResolvedValue(overrides.services ?? []),
    findOptionsByIds: jest.fn().mockResolvedValue(overrides.options ?? []),
    findRequiredOptionsForServices: jest.fn().mockResolvedValue(overrides.requiredOptions ?? []),
  } as unknown as CatalogPublicApi;

  const settings = {
    getNumber: jest.fn().mockResolvedValue(overrides.taxRateBasisPoints ?? 2000),
  } as unknown as SettingsService;

  return new ConfiguratorService(rules, catalog, settings);
}

const baseInput = {
  deviceModelId: "model-1",
  deviceVariantId: "variant-1",
  serviceIds: ["service-1"],
  optionIds: [],
};

describe("ConfiguratorService", () => {
  it("calcule un prix entier en centimes, sans nombre flottant, TVA incluse", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 4999, name: "Correction du drift" }],
      taxRateBasisPoints: 2000,
    });

    const result = await configurator.validate(baseInput);

    expect(result.valid).toBe(true);
    expect(Number.isInteger(result.price.subtotalMinor)).toBe(true);
    expect(Number.isInteger(result.price.taxMinor)).toBe(true);
    expect(Number.isInteger(result.price.totalMinor)).toBe(true);
    expect(result.price.subtotalMinor).toBe(4999);
    expect(result.price.taxMinor).toBe(1000); // arrondi de 4999 * 0.20 = 999.8 -> 1000
    expect(result.price.totalMinor).toBe(5999);
  });

  it("bloque une configuration si le modele n'est pas actif", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "A" }],
      modelActive: false,
    });
    const result = await configurator.validate(baseInput);
    expect(result.valid).toBe(false);
  });

  it("bloque une prestation inexistante ou inactive", async () => {
    const configurator = buildService({ services: [] });
    const result = await configurator.validate(baseInput);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.relatedServiceId === "service-1")).toBe(true);
  });

  it("bloque les doublons de prestations selectionnees", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "A" }],
    });
    const result = await configurator.validate({ ...baseInput, serviceIds: ["service-1", "service-1"] });
    expect(result.valid).toBe(false);
  });

  it("bloque une configuration hors du perimetre de compatibilite declare", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "Joystick Hall Effect" }],
      compatibilityRules: [{ serviceId: "service-1", deviceModelId: "un-autre-modele", deviceVariantId: null, hardwareRevisionId: null }],
    });

    const result = await configurator.validate(baseInput);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "INCOMPATIBLE")).toBe(true);
  });

  it("bloque deux prestations mutuellement exclusives", async () => {
    const configurator = buildService({
      services: [
        { id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "A" },
        { id: "service-2", status: "ACTIVE", basePriceMinor: 1000, name: "B" },
      ],
      exclusionRules: [{ serviceAId: "service-1", serviceBId: "service-2", reason: "Incompatibles" }],
    });

    const result = await configurator.validate({ ...baseInput, serviceIds: ["service-1", "service-2"] });

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "INCOMPATIBLE")).toBe(true);
  });

  it("bloque une prestation dont la dependance obligatoire n'est pas selectionnee", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "Kit clic souris" }],
      requirementRules: [{ serviceId: "service-1", requiredServiceId: "service-required" }],
    });

    const result = await configurator.validate(baseInput);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "REQUIRES")).toBe(true);
  });

  it("bloque une option obligatoire non selectionnee", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "A" }],
      requiredOptions: [{ id: "option-required", serviceId: "service-1" }],
    });
    const result = await configurator.validate(baseInput);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.type === "MISSING_REQUIRED_OPTION")).toBe(true);
  });

  it("inclut le prix des options selectionnees dans le total", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "A" }],
      options: [{ id: "option-1", status: "ACTIVE", serviceId: "service-1", extraPriceMinor: 500, name: "Option premium" }],
      taxRateBasisPoints: 0,
    });
    const result = await configurator.validate({ ...baseInput, optionIds: ["option-1"] });
    expect(result.valid).toBe(true);
    expect(result.price.subtotalMinor).toBe(1500);
    expect(result.price.breakdown).toHaveLength(2);
  });

  it("produit une recommandation non bloquante", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "A" }],
      recommendationRules: [{ serviceId: "service-1", recommendedServiceId: "service-2", message: "Pensez aussi a ceci" }],
    });

    const result = await configurator.validate(baseInput);

    expect(result.valid).toBe(true);
    expect(result.recommendations).toHaveLength(1);
  });

  it("ne calcule jamais de tarif professionnel sans trustedCompanyId fourni par l'appelant serveur", async () => {
    const configurator = buildService({
      services: [{ id: "service-1", status: "ACTIVE", basePriceMinor: 1000, name: "A" }],
      pricingRules: [
        { serviceId: "service-1", clientType: "PROFESSIONAL", amountMinor: 100, deviceModelId: null, deviceVariantId: null, productFamilyId: null, validFrom: null, validUntil: null },
      ],
      taxRateBasisPoints: 0,
    });
    // Aucun trustedCompanyId transmis : le tarif PROFESSIONAL ne doit jamais s'appliquer.
    const result = await configurator.validate(baseInput);
    expect(result.price.subtotalMinor).toBe(1000);
  });
});
