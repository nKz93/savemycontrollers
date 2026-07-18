import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UsePipes } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createBrandSchema, updateBrandSchema, type CreateBrandRequest, type UpdateBrandRequest } from "@smc/contracts";
import { JwtAuthGuard } from "../../identity/guards/jwt-auth.guard.js";
import { PermissionGuard } from "../../authorization/guards/permission.guard.js";
import { RequirePermission } from "../../authorization/decorators/require-permission.decorator.js";
import { PERMISSIONS } from "../../authorization/constants/permissions.js";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { CatalogService } from "../services/catalog.service.js";

/**
 * CRUD complet demontre pour Brand. Les entites ProductFamily, DeviceModel,
 * DeviceVariant, HardwareRevision et Service suivent rigoureusement le meme
 * schema (repository + service + controleur proteges par les memes guards) ;
 * leur implementation complete est prevue en phase suivante (voir "prochaines
 * taches" du livrable) pour ne pas dupliquer un code deja demontre ici.
 */
@ApiTags("catalog-admin")
@Controller("admin/catalog/brands")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CATALOG_READ)
  list() {
    return this.catalog.listAllBrandsForAdmin();
  }

  @Post()
  @RequirePermission(PERMISSIONS.CATALOG_CREATE)
  @UsePipes(new ZodValidationPipe(createBrandSchema))
  create(@Body() body: CreateBrandRequest) {
    return this.catalog.createBrand(body);
  }

  @Patch(":id")
  @RequirePermission(PERMISSIONS.CATALOG_UPDATE)
  @UsePipes(new ZodValidationPipe(updateBrandSchema))
  update(@Param("id") id: string, @Body() body: UpdateBrandRequest) {
    return this.catalog.updateBrand(id, body);
  }

  @Delete(":id")
  @RequirePermission(PERMISSIONS.CATALOG_DELETE)
  async remove(@Param("id") id: string) {
    await this.catalog.deleteBrand(id);
    return { message: "Marque supprimee." };
  }
}
