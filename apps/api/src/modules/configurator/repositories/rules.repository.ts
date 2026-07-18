import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class RulesRepository {
  private readonly prisma = getPrismaClient();

  compatibilityRulesForServices(serviceIds: string[]) {
    return this.prisma.compatibilityRule.findMany({ where: { serviceId: { in: serviceIds } } });
  }

  exclusionRulesForServices(serviceIds: string[]) {
    return this.prisma.exclusionRule.findMany({
      where: { OR: [{ serviceAId: { in: serviceIds } }, { serviceBId: { in: serviceIds } }] },
    });
  }

  requirementRulesForServices(serviceIds: string[]) {
    return this.prisma.requirementRule.findMany({ where: { serviceId: { in: serviceIds } } });
  }

  recommendationRulesForServices(serviceIds: string[]) {
    return this.prisma.recommendationRule.findMany({ where: { serviceId: { in: serviceIds } } });
  }

  pricingRulesForServices(serviceIds: string[]) {
    return this.prisma.pricingRule.findMany({ where: { serviceId: { in: serviceIds } } });
  }

  companyOverridesForServices(companyId: string, serviceIds: string[]) {
    return this.prisma.companyPricingOverride.findMany({
      where: { companyId, serviceId: { in: serviceIds } },
    });
  }

  leadTimeRulesForServices(serviceIds: string[]) {
    return this.prisma.leadTimeRule.findMany({ where: { serviceId: { in: serviceIds } } });
  }
}
