import { Injectable } from "@nestjs/common";
import { ConfiguratorService } from "./services/configurator.service.js";
import type { ConfigurationResultDto, ValidateConfigurationRequest } from "@smc/contracts";

/**
 * Interface publique du module Configurator. Orders (et tout autre module
 * externe) ne doit jamais importer ConfiguratorService ou RulesRepository
 * directement — uniquement cette facade.
 */
@Injectable()
export class ConfiguratorPublicApi {
  constructor(private readonly configurator: ConfiguratorService) {}

  validate(input: ValidateConfigurationRequest, trustedCompanyId?: string): Promise<ConfigurationResultDto> {
    return this.configurator.validate(input, trustedCompanyId);
  }
}
