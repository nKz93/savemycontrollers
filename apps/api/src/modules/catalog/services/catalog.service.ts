import { Injectable } from "@nestjs/common";
import { BrandRepository } from "../repositories/brand.repository.js";
import { DeviceModelRepository } from "../repositories/device-model.repository.js";
import { ServiceRepository } from "../repositories/service.repository.js";
import { ConflictDomainError, NotFoundDomainError } from "../../core/errors/domain-error.js";
import type { CreateBrandRequest, UpdateBrandRequest, DeviceModelDetailDto } from "@smc/contracts";

@Injectable()
export class CatalogService {
  constructor(
    private readonly brands: BrandRepository,
    private readonly deviceModels: DeviceModelRepository,
    private readonly services: ServiceRepository,
  ) {}

  listActiveBrands() {
    return this.brands.listActive();
  }

  listActiveDeviceModels() {
    return this.deviceModels.listActive();
  }

  listActiveServices() {
    return this.services.listActive();
  }

  async getDeviceModelName(id: string): Promise<string> {
    const model = await this.deviceModels.findById(id);
    if (!model) throw new NotFoundDomainError("Modele introuvable.");
    return model.name;
  }

  async getDeviceVariantName(deviceModelId: string, deviceVariantId: string): Promise<string> {
    const model = await this.deviceModels.findById(deviceModelId);
    const variant = model?.variants.find((v) => v.id === deviceVariantId);
    if (!variant) throw new NotFoundDomainError("Variante introuvable.");
    return variant.name;
  }

  async getDeviceModelDetail(familySlug: string, modelSlug: string): Promise<DeviceModelDetailDto> {
    const model = await this.deviceModels.findBySlugWithDetails(familySlug, modelSlug);
    if (!model) throw new NotFoundDomainError("Modele introuvable.");
    return {
      id: model.id,
      slug: model.slug,
      name: model.name,
      status: model.status,
      shortDescription: model.shortDescription,
      longDescription: model.longDescription,
      brand: { id: model.family.brand.id, slug: model.family.brand.slug, name: model.family.brand.name },
      family: { id: model.family.id, slug: model.family.slug, name: model.family.name },
      variants: model.variants.map((v) => ({
        id: v.id,
        name: v.name,
        status: v.status,
        revisions: v.revisions.map((r) => ({ id: r.id, code: r.code, label: r.label })),
      })),
    };
  }

  async isDeviceModelActive(deviceModelId: string): Promise<boolean> {
    const model = await this.deviceModels.findById(deviceModelId);
    return model?.status === "ACTIVE";
  }

  async isDeviceVariantActive(deviceModelId: string, deviceVariantId: string): Promise<boolean> {
    const model = await this.deviceModels.findById(deviceModelId);
    const variant = model?.variants.find((v) => v.id === deviceVariantId);
    return variant?.status === "ACTIVE";
  }

  async isHardwareRevisionValid(deviceVariantId: string, hardwareRevisionId: string): Promise<boolean> {
    return this.deviceModels.hardwareRevisionBelongsToVariant(deviceVariantId, hardwareRevisionId);
  }

  // --- Administration (CRUD protege par PermissionGuard au niveau controleur) ---

  listAllBrandsForAdmin() {
    return this.brands.listAll();
  }

  async createBrand(input: CreateBrandRequest) {
    const existing = await this.brands.findBySlug(input.slug);
    if (existing) throw new ConflictDomainError("Ce slug de marque existe deja.");
    return this.brands.create({
      slug: input.slug,
      name: input.name,
      shortDescription: input.shortDescription,
      displayOrder: input.displayOrder,
      status: input.status,
    });
  }

  async updateBrand(id: string, input: UpdateBrandRequest) {
    const existing = await this.brands.findById(id);
    if (!existing) throw new NotFoundDomainError("Marque introuvable.");
    return this.brands.update(id, input);
  }

  async deleteBrand(id: string): Promise<void> {
    const existing = await this.brands.findById(id);
    if (!existing) throw new NotFoundDomainError("Marque introuvable.");
    const familyCount = await this.brands.countFamilies(id);
    if (familyCount > 0) {
      throw new ConflictDomainError("Impossible de supprimer une marque qui possede des familles de produits. Archivez-la plutot.");
    }
    await this.brands.delete(id);
  }
}
