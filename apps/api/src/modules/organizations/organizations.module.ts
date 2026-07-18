import { Module } from "@nestjs/common";
import { CompanyRepository } from "./repositories/company.repository.js";
import { CompanyService } from "./services/company.service.js";
import { OrganizationsPublicApi } from "./organizations.public-api.js";
import { OutboxModule } from "../outbox/outbox.module.js";

@Module({
  imports: [OutboxModule],
  providers: [CompanyRepository, CompanyService, OrganizationsPublicApi],
  exports: [OrganizationsPublicApi],
})
export class OrganizationsModule {}
