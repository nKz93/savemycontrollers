import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  createAddressSchema,
  updateAddressSchema,
  type CreateAddressRequest,
  type UpdateAddressRequest,
} from "@smc/contracts";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { AddressService } from "../services/address.service.js";
import { JwtAuthGuard, type RequestWithUser } from "../../identity/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { AddressResponseDto, CreateAddressBodyDto, UpdateAddressBodyDto } from "../swagger/address.swagger-dto.js";

/**
 * Adresses personnelles du client authentifie. `userId` provient
 * exclusivement de @CurrentUser() (JWT) sur chaque route ; aucun
 * identifiant de proprietaire n'est jamais lu depuis le corps de la
 * requete ou l'URL (voir section 4 du prompt).
 */
@ApiTags("addresses")
@Controller("addresses")
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addresses: AddressService) {}

  @Get()
  @ApiResponse({ status: 200, type: [AddressResponseDto] })
  list(@CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.addresses.list(user!.id);
  }

  @Get(":id")
  @ApiResponse({ status: 200, type: AddressResponseDto })
  @ApiResponse({ status: 404, description: "Adresse introuvable ou n'appartenant pas a l'utilisateur courant." })
  get(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.addresses.get(user!.id, id);
  }

  @Post()
  @ApiBody({ type: CreateAddressBodyDto })
  @ApiResponse({ status: 201, type: AddressResponseDto })
  create(@Body(new ZodValidationPipe(createAddressSchema)) body: CreateAddressRequest, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.addresses.create(user!.id, body);
  }

  @Patch(":id")
  @ApiBody({ type: UpdateAddressBodyDto })
  @ApiResponse({ status: 200, type: AddressResponseDto })
  @ApiResponse({ status: 404, description: "Adresse introuvable ou n'appartenant pas a l'utilisateur courant." })
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateAddressSchema)) body: UpdateAddressRequest,
    @CurrentUser() user: RequestWithUser["currentUser"],
  ) {
    return this.addresses.update(user!.id, id, body);
  }

  @Delete(":id")
  @ApiResponse({ status: 200, description: "Adresse supprimee." })
  @ApiResponse({ status: 404, description: "Adresse introuvable ou n'appartenant pas a l'utilisateur courant." })
  async remove(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    await this.addresses.remove(user!.id, id);
    return { deleted: true };
  }
}
