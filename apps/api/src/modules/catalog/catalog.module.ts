import { Module } from "@nestjs/common";
import { BrandRepository } from "./repositories/brand.repository.js";
import { DeviceModelRepository } from "./repositories/device-model.repository.js";
import { ServiceRepository } from "./repositories/service.repository.js";
import { CatalogService } from "./services/catalog.service.js";
import { CatalogPublicApi } from "./catalog.public-api.js";
import { CatalogPublicController } from "./controllers/catalog-public.controller.js";
import { CatalogAdminController } from "./controllers/catalog-admin.controller.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { IdentityModule } from "../identity/identity.module.js";

@Module({
  imports: [AuthorizationModule, IdentityModule],
  controllers: [CatalogPublicController, CatalogAdminController],
  providers: [BrandRepository, DeviceModelRepository, ServiceRepository, CatalogService, CatalogPublicApi],
  // Seule CatalogPublicApi est exportee : un module externe ne doit jamais
  // pouvoir importer ServiceRepository/DeviceModelRepository/CatalogService
  // directement (voir ADR-005 et regle eslint-plugin-boundaries).
  exports: [CatalogPublicApi],
})
export class CatalogModule {}
