import { Controller, Get, Param } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { CatalogService } from "../services/catalog.service.js";
import type { BrandDto, DeviceModelDto, ServiceDto } from "@smc/contracts";
import {
  BrandResponseDto,
  DeviceModelResponseDto,
  DeviceModelDetailResponseDto,
  ServiceResponseDto,
} from "../swagger/catalog.swagger-dto.js";

/**
 * Endpoints publics en lecture seule, consommes par le site vitrine et le
 * configurateur. Aucune authentification requise, mais seuls les elements
 * au statut ACTIVE sont exposes (jamais un brouillon).
 */
@ApiTags("catalog")
@Controller("catalog")
export class CatalogPublicController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("brands")
  @ApiResponse({ status: 200, type: [BrandResponseDto] })
  async listBrands(): Promise<BrandDto[]> {
    const brands = await this.catalog.listActiveBrands();
    return brands.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      status: b.status,
      displayOrder: b.displayOrder,
      shortDescription: b.shortDescription,
      logoUrl: null, // resolu via une URL signee a la demande (module Files), non calcule en liste
    }));
  }

  @Get("device-models")
  @ApiResponse({ status: 200, type: [DeviceModelResponseDto] })
  async listDeviceModels(): Promise<DeviceModelDto[]> {
    const models = await this.catalog.listActiveDeviceModels();
    return models.map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      brandId: m.family.brandId,
      familyId: m.familyId,
      familySlug: m.family.slug,
      status: m.status,
      shortDescription: m.shortDescription,
      longDescription: m.longDescription,
      variants: m.variants.map((v) => ({
        id: v.id,
        name: v.name,
        status: v.status,
        revisions: v.revisions.map((r) => ({ id: r.id, code: r.code, label: r.label })),
      })),
    }));
  }

  @Get("device-models/:familySlug/:modelSlug")
  @ApiResponse({ status: 200, type: DeviceModelDetailResponseDto })
  @ApiResponse({ status: 404, description: "Modele introuvable." })
  async getDeviceModel(@Param("familySlug") familySlug: string, @Param("modelSlug") modelSlug: string) {
    return this.catalog.getDeviceModelDetail(familySlug, modelSlug);
  }

  @Get("services")
  @ApiResponse({ status: 200, type: [ServiceResponseDto] })
  async listServices(): Promise<ServiceDto[]> {
    const services = await this.catalog.listActiveServices();
    return services.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      categoryId: s.categoryId,
      status: s.status,
      basePrice: { amountMinor: s.basePriceMinor, currency: s.currency },
      shortDescription: s.shortDescription,
      options: s.options.map((o) => ({
        id: o.id,
        slug: o.slug,
        name: o.name,
        isRequired: o.isRequired,
        extraPrice: { amountMinor: o.extraPriceMinor, currency: o.currency },
      })),
    }));
  }
}
