import { Module } from "@nestjs/common";
import { SettingsRepository } from "./repositories/settings.repository.js";
import { SettingsService } from "./services/settings.service.js";

@Module({
  providers: [SettingsRepository, SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
