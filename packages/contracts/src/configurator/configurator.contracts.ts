import { z } from "zod";

export const startConfigurationSchema = z.object({
  deviceModelId: z.string().uuid(),
  deviceVariantId: z.string().uuid(),
  hardwareRevisionId: z.string().uuid().optional(),
});
export type StartConfigurationRequest = z.infer<typeof startConfigurationSchema>;

export const validateConfigurationSchema = z.object({
  deviceModelId: z.string().uuid(),
  deviceVariantId: z.string().uuid(),
  hardwareRevisionId: z.string().uuid().optional(),
  serviceIds: z.array(z.string().uuid()).min(1),
  optionIds: z.array(z.string().uuid()).default([]),
  // companyId est INTENTIONNELLEMENT ABSENT de ce contrat public : un
  // client anonyme ne doit jamais pouvoir fournir un identifiant
  // d'entreprise pour obtenir un tarif negocie. Le tarif professionnel
  // n'est resolu que cote serveur, a partir de l'utilisateur authentifie
  // et de son appartenance verifiee (voir CompanyMembershipGuard et
  // ConfiguratorService.validate, second parametre `trustedCompanyId`).
});
export type ValidateConfigurationRequest = z.infer<typeof validateConfigurationSchema>;

export interface ConfigurationIssueDto {
  type: "INCOMPATIBLE" | "REQUIRES" | "MISSING_REQUIRED_OPTION";
  severity: "BLOCKING" | "INFO";
  message: string;
  relatedServiceId?: string;
  relatedOptionId?: string;
}

export interface ConfigurationRecommendationDto {
  message: string;
  relatedServiceId?: string;
  relatedOptionId?: string;
}

export interface ConfigurationPriceLineDto {
  kind: "SERVICE" | "OPTION";
  id: string;
  name: string;
  unitPriceMinor: number;
  currency: "EUR";
}

export interface ConfigurationResultDto {
  valid: boolean;
  issues: ConfigurationIssueDto[];
  recommendations: ConfigurationRecommendationDto[];
  price: {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    currency: "EUR";
    breakdown: ConfigurationPriceLineDto[];
  };
  estimatedLeadTimeDays: {
    min: number;
    max: number;
  };
}
