import { Module } from "@nestjs/common";
import { RulesRepository } from "./repositories/rules.repository.js";
import { ConfiguratorService } from "./services/configurator.service.js";
import { ConfiguratorPublicApi } from "./configurator.public-api.js";
import { ConfiguratorController } from "./controllers/configurator.controller.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { SettingsModule } from "../settings/settings.module.js";

@Module({
  imports: [CatalogModule, SettingsModule],
  controllers: [ConfiguratorController],
  providers: [RulesRepository, ConfiguratorService, ConfiguratorPublicApi],
  exports: [ConfiguratorPublicApi],
})
export class ConfiguratorModule {}
