import { Injectable } from "@nestjs/common";
import { CompanyService } from "./services/company.service.js";

/**
 * Interface publique du module Organizations. Tout module externe (Orders,
 * Configurator...) doit passer par cette facade pour toute verification
 * d'appartenance a une entreprise.
 */
@Injectable()
export class OrganizationsPublicApi {
  constructor(private readonly companies: CompanyService) {}

  async assertActiveApprovedMember(companyId: string, userId: string) {
    return this.companies.assertActiveApprovedMember(companyId, userId);
  }
}
