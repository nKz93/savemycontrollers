import { Injectable } from "@nestjs/common";
import { CatalogService } from "./services/catalog.service.js";
import { ServiceRepository } from "./repositories/service.repository.js";
import type { Service } from "@smc/database";

/**
 * Interface publique du module Catalog. Tout module externe (Orders,
 * Configurator...) doit obligatoirement passer par cette facade — jamais
 * par ServiceRepository/DeviceModelRepository/BrandRepository directement
 * (voir ADR-005 et regle eslint-plugin-boundaries).
 */
@Injectable()
export class CatalogPublicApi {
  constructor(private readonly catalog: CatalogService, private readonly services: ServiceRepository) {}

  findServicesByIds(ids: string[]): Promise<Service[]> {
    return this.services.findManyByIds(ids);
  }

  findOptionsByIds(ids: string[]) {
    return this.services.findOptionsByIds(ids);
  }

  findRequiredOptionsForServices(serviceIds: string[]) {
    return this.services.findRequiredOptionsForServices(serviceIds);
  }

  getDeviceModelName(id: string): Promise<string> {
    return this.catalog.getDeviceModelName(id);
  }

  getDeviceVariantName(deviceModelId: string, deviceVariantId: string): Promise<string> {
    return this.catalog.getDeviceVariantName(deviceModelId, deviceVariantId);
  }

  isDeviceModelActive(deviceModelId: string): Promise<boolean> {
    return this.catalog.isDeviceModelActive(deviceModelId);
  }

  isDeviceVariantActive(deviceModelId: string, deviceVariantId: string): Promise<boolean> {
    return this.catalog.isDeviceVariantActive(deviceModelId, deviceVariantId);
  }

  isHardwareRevisionValid(deviceVariantId: string, hardwareRevisionId: string): Promise<boolean> {
    return this.catalog.isHardwareRevisionValid(deviceVariantId, hardwareRevisionId);
  }
}
