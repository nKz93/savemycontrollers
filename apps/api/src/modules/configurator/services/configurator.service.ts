import { Injectable } from "@nestjs/common";
import { RulesRepository } from "../repositories/rules.repository.js";
import { CatalogPublicApi } from "../../catalog/catalog.public-api.js";
import { SettingsService } from "../../settings/services/settings.service.js";
import type {
  ConfigurationIssueDto,
  ConfigurationPriceLineDto,
  ConfigurationRecommendationDto,
  ConfigurationResultDto,
  ValidateConfigurationRequest,
} from "@smc/contracts";

const DEFAULT_TAX_RATE_BASIS_POINTS = 2000; // 20,00 % — valeur par defaut, ecrasee par Settings des que configure
const DEFAULT_LEAD_TIME_DAYS = { min: 5, max: 10 };

/**
 * Moteur de configuration pilote par les donnees. Le calcul est
 * exclusivement execute cote serveur : le frontend ne doit jamais recalculer
 * un prix, il affiche uniquement le resultat retourne ici (voir section 14
 * de l'architecture).
 *
 * `trustedCompanyId` (deuxieme parametre de `validate`) ne doit JAMAIS
 * provenir directement d'une entree utilisateur non verifiee : c'est a
 * l'appelant (controleur/service) de resoudre cet identifiant a partir de
 * l'utilisateur authentifie et de verifier son appartenance active et
 * approuvee (voir OrganizationsPublicApi.assertActiveApprovedMember) avant
 * de l'injecter ici. Voir ADR-013.
 */
@Injectable()
export class ConfiguratorService {
  constructor(
    private readonly rules: RulesRepository,
    private readonly catalog: CatalogPublicApi,
    private readonly settings: SettingsService,
  ) {}

  async validate(input: ValidateConfigurationRequest, trustedCompanyId?: string): Promise<ConfigurationResultDto> {
    const issues: ConfigurationIssueDto[] = [];
    const recommendations: ConfigurationRecommendationDto[] = [];

    // --- 0) Existence et statut du perimetre materiel ---
    const modelActive = await this.catalog.isDeviceModelActive(input.deviceModelId);
    if (!modelActive) {
      issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "Modele introuvable ou indisponible." });
    }
    const variantActive = await this.catalog.isDeviceVariantActive(input.deviceModelId, input.deviceVariantId);
    if (!variantActive) {
      issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "Variante introuvable, indisponible, ou n'appartient pas au modele." });
    }
    if (input.hardwareRevisionId) {
      const revisionValid = await this.catalog.isHardwareRevisionValid(input.deviceVariantId, input.hardwareRevisionId);
      if (!revisionValid) {
        issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "Revision materielle introuvable ou n'appartient pas a la variante." });
      }
    }

    // --- 1) Doublons de prestations ---
    const uniqueServiceIds = new Set(input.serviceIds);
    if (uniqueServiceIds.size !== input.serviceIds.length) {
      issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "La meme prestation est selectionnee plusieurs fois." });
    }

    // --- 2) Existence + statut actif de chaque prestation ---
    const services = await this.catalog.findServicesByIds([...uniqueServiceIds]);
    const servicesById = new Map(services.map((s) => [s.id, s]));
    for (const serviceId of uniqueServiceIds) {
      const service = servicesById.get(serviceId);
      if (!service) {
        issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "Une prestation selectionnee n'existe pas.", relatedServiceId: serviceId });
      } else if (service.status !== "ACTIVE") {
        issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "Une prestation selectionnee n'est plus active.", relatedServiceId: serviceId });
      }
    }

    // --- 3) Options : existence, appartenance a une prestation selectionnee, statut actif, obligation ---
    const uniqueOptionIds = new Set(input.optionIds);
    const options = uniqueOptionIds.size > 0 ? await this.catalog.findOptionsByIds([...uniqueOptionIds]) : [];
    const optionsById = new Map(options.map((o) => [o.id, o]));
    for (const optionId of uniqueOptionIds) {
      const option = optionsById.get(optionId);
      if (!option) {
        issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "Une option selectionnee n'existe pas.", relatedOptionId: optionId });
        continue;
      }
      if (!uniqueServiceIds.has(option.serviceId)) {
        issues.push({
          type: "INCOMPATIBLE",
          severity: "BLOCKING",
          message: "Une option selectionnee n'appartient a aucune prestation selectionnee.",
          relatedOptionId: optionId,
        });
      }
      if (option.status !== "ACTIVE") {
        issues.push({ type: "INCOMPATIBLE", severity: "BLOCKING", message: "Une option selectionnee n'est plus active.", relatedOptionId: optionId });
      }
    }
    // Options obligatoires non selectionnees, pour chaque prestation selectionnee
    const requiredOptionsByService = await this.catalog.findRequiredOptionsForServices([...uniqueServiceIds]);
    for (const requiredOption of requiredOptionsByService) {
      if (!uniqueOptionIds.has(requiredOption.id)) {
        issues.push({
          type: "MISSING_REQUIRED_OPTION",
          severity: "BLOCKING",
          message: "Une option obligatoire n'a pas ete selectionnee pour une prestation choisie.",
          relatedServiceId: requiredOption.serviceId,
          relatedOptionId: requiredOption.id,
        });
      }
    }

    // --- 4) Compatibilite (liste blanche), par modele/variante/revision/piece ---
    const compatibilityRules = await this.rules.compatibilityRulesForServices([...uniqueServiceIds]);
    const rulesByService = groupBy(compatibilityRules, (r) => r.serviceId);
    for (const serviceId of uniqueServiceIds) {
      const serviceRules = rulesByService.get(serviceId);
      if (!serviceRules || serviceRules.length === 0) continue; // pas de restriction = compatible partout
      const matches = serviceRules.some(
        (rule) =>
          (!rule.deviceModelId || rule.deviceModelId === input.deviceModelId) &&
          (!rule.deviceVariantId || rule.deviceVariantId === input.deviceVariantId) &&
          (!rule.hardwareRevisionId || rule.hardwareRevisionId === input.hardwareRevisionId),
      );
      if (!matches) {
        issues.push({
          type: "INCOMPATIBLE",
          severity: "BLOCKING",
          message: "Cette prestation n'est pas compatible avec le modele/variante/revision selectionne.",
          relatedServiceId: serviceId,
        });
      }
    }

    // --- 5) Exclusions mutuelles ---
    const exclusions = await this.rules.exclusionRulesForServices([...uniqueServiceIds]);
    for (const exclusion of exclusions) {
      if (uniqueServiceIds.has(exclusion.serviceAId) && uniqueServiceIds.has(exclusion.serviceBId)) {
        issues.push({
          type: "INCOMPATIBLE",
          severity: "BLOCKING",
          message: exclusion.reason ?? "Ces deux prestations ne peuvent pas etre combinees.",
          relatedServiceId: exclusion.serviceAId,
        });
      }
    }

    // --- 6) Dependances obligatoires ---
    const requirements = await this.rules.requirementRulesForServices([...uniqueServiceIds]);
    for (const requirement of requirements) {
      if (!uniqueServiceIds.has(requirement.requiredServiceId)) {
        issues.push({
          type: "REQUIRES",
          severity: "BLOCKING",
          message: "Cette prestation necessite une prestation complementaire non selectionnee.",
          relatedServiceId: requirement.serviceId,
        });
      }
    }

    // --- 7) Recommandations (non bloquantes) ---
    const recommendationRules = await this.rules.recommendationRulesForServices([...uniqueServiceIds]);
    for (const recommendation of recommendationRules) {
      if (!uniqueServiceIds.has(recommendation.recommendedServiceId)) {
        recommendations.push({ message: recommendation.message, relatedServiceId: recommendation.serviceId });
      }
    }

    const valid = issues.every((issue) => issue.severity !== "BLOCKING");

    // --- 8) Prix (uniquement si la configuration est structurellement valide) ---
    const price = valid
      ? await this.computePrice(services, options.filter((o) => uniqueOptionIds.has(o.id)), input, trustedCompanyId)
      : { subtotalMinor: 0, discountMinor: 0, taxMinor: 0, totalMinor: 0, currency: "EUR" as const, breakdown: [] as ConfigurationPriceLineDto[] };

    // --- 9) Delai estime, filtre strictement sur le modele selectionne ---
    const leadTimeRules = await this.rules.leadTimeRulesForServices([...uniqueServiceIds]);
    const applicableLeadTimeRules = leadTimeRules.filter((r) => !r.deviceModelId || r.deviceModelId === input.deviceModelId);
    const estimatedLeadTimeDays = applicableLeadTimeRules.reduce(
      (acc, rule) => ({ min: Math.max(acc.min, rule.minDays), max: Math.max(acc.max, rule.maxDays) }),
      DEFAULT_LEAD_TIME_DAYS,
    );

    return { valid, issues, recommendations, price, estimatedLeadTimeDays };
  }

  private async computePrice(
    services: Array<{ id: string; name: string; basePriceMinor: number }>,
    selectedOptions: Array<{ id: string; name: string; extraPriceMinor: number; serviceId: string }>,
    input: ValidateConfigurationRequest,
    trustedCompanyId?: string,
  ): Promise<ConfigurationResultDto["price"]> {
    const serviceIds = services.map((s) => s.id);
    const pricingRules = await this.rules.pricingRulesForServices(serviceIds);
    const companyOverrides = trustedCompanyId
      ? await this.rules.companyOverridesForServices(trustedCompanyId, serviceIds)
      : [];

    const now = new Date();
    const activePricingRules = pricingRules.filter(
      (r) => (!r.validFrom || r.validFrom <= now) && (!r.validUntil || r.validUntil >= now),
    );
    const activeOverrides = companyOverrides.filter(
      (o) => (!o.validFrom || o.validFrom <= now) && (!o.validUntil || o.validUntil >= now),
    );

    const breakdown: ConfigurationPriceLineDto[] = [];
    let subtotalMinor = 0;

    for (const service of services) {
      const override = activeOverrides.find((o) => o.serviceId === service.id);
      let unitPriceMinor: number;
      if (override) {
        unitPriceMinor = override.amountMinor;
      } else {
        const clientType = trustedCompanyId ? "PROFESSIONAL" : "STANDARD";
        const applicableRules = activePricingRules.filter((r) => r.serviceId === service.id && r.clientType === clientType);
        const mostSpecific = pickMostSpecificPricingRule(applicableRules, input);
        unitPriceMinor = mostSpecific ? mostSpecific.amountMinor : service.basePriceMinor;
      }
      subtotalMinor += unitPriceMinor;
      breakdown.push({ kind: "SERVICE", id: service.id, name: service.name, unitPriceMinor, currency: "EUR" });
    }

    for (const option of selectedOptions) {
      subtotalMinor += option.extraPriceMinor;
      breakdown.push({ kind: "OPTION", id: option.id, name: option.name, unitPriceMinor: option.extraPriceMinor, currency: "EUR" });
    }

    const discountMinor = 0; // les remises quantitatives s'appliquent au niveau du panier (quantite reelle), pas d'une configuration unitaire
    const taxRateBasisPoints = await this.settings
      .getNumber("tax.default_rate_basis_points", DEFAULT_TAX_RATE_BASIS_POINTS)
      .catch(() => DEFAULT_TAX_RATE_BASIS_POINTS);
    const taxableAmount = subtotalMinor - discountMinor;
    const taxMinor = Math.round((taxableAmount * taxRateBasisPoints) / 10000);
    const totalMinor = taxableAmount + taxMinor;

    return { subtotalMinor, discountMinor, taxMinor, totalMinor, currency: "EUR", breakdown };
  }
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function pickMostSpecificPricingRule<
  T extends { deviceVariantId: string | null; deviceModelId: string | null; productFamilyId: string | null; amountMinor: number },
>(rules: T[], input: { deviceVariantId: string; deviceModelId: string }): T | undefined {
  return (
    rules.find((r) => r.deviceVariantId === input.deviceVariantId) ??
    rules.find((r) => r.deviceModelId === input.deviceModelId) ??
    rules.find((r) => !r.deviceVariantId && !r.deviceModelId && !r.productFamilyId)
  );
}
