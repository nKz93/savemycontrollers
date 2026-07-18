import { Body, Controller, Get, Param, Patch, Post, UseGuards, UsePipes } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import {
  addClientMessageSchema,
  addInternalNoteSchema,
  changeStatusSchema,
  type AddClientMessageRequest,
  type AddInternalNoteRequest,
  type ChangeStatusRequest,
} from "@smc/contracts";
import { JwtAuthGuard, type RequestWithUser } from "../../identity/guards/jwt-auth.guard.js";
import { PermissionGuard } from "../../authorization/guards/permission.guard.js";
import { RequirePermission } from "../../authorization/decorators/require-permission.decorator.js";
import { PERMISSIONS } from "../../authorization/constants/permissions.js";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { RepairCaseService } from "../services/repair-case.service.js";

@ApiTags("repairs")
@Controller()
export class RepairCaseController {
  constructor(private readonly repairCases: RepairCaseService) {}

  @Get("client/repair-cases")
  @UseGuards(JwtAuthGuard)
  listMine(@CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.repairCases.listForClient(user!.id);
  }

  @Get("client/repair-cases/:id")
  @UseGuards(JwtAuthGuard)
  getMine(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.repairCases.getForClient(id, user!.id);
  }

  @Get("staff/repair-cases/:id")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.ORDER_READ)
  getForStaff(@Param("id") id: string) {
    return this.repairCases.getForStaff(id);
  }

  @Patch("staff/repair-cases/:id/status")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.REPAIR_CHANGE_STATUS)
  @UsePipes(new ZodValidationPipe(changeStatusSchema))
  changeStatus(
    @Param("id") id: string,
    @Body() body: ChangeStatusRequest,
    @CurrentUser() user: RequestWithUser["currentUser"],
  ) {
    return this.repairCases.changeStatus(id, body.toStatusKey, { userId: user!.id, correlationId: randomUUID() }, body.comment);
  }

  @Post("staff/repair-cases/:id/assign/:technicianId")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.REPAIR_ASSIGN)
  assign(
    @Param("id") id: string,
    @Param("technicianId") technicianId: string,
    @CurrentUser() user: RequestWithUser["currentUser"],
  ) {
    return this.repairCases.assignTechnician(id, technicianId, { userId: user!.id, correlationId: randomUUID() });
  }

  @Post("staff/repair-cases/:id/internal-notes")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.REPAIR_WRITE_INTERNAL_NOTES)
  @UsePipes(new ZodValidationPipe(addInternalNoteSchema))
  addInternalNote(
    @Param("id") id: string,
    @Body() body: AddInternalNoteRequest,
    @CurrentUser() user: RequestWithUser["currentUser"],
  ) {
    return this.repairCases.addInternalNote(id, user!.id, body.body);
  }

  @Post("staff/repair-cases/:id/client-messages")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.ORDER_UPDATE)
  @UsePipes(new ZodValidationPipe(addClientMessageSchema))
  addClientMessageFromStaff(
    @Param("id") id: string,
    @Body() body: AddClientMessageRequest,
    @CurrentUser() user: RequestWithUser["currentUser"],
  ) {
    return this.repairCases.addClientMessage(id, user!.id, body.body);
  }

  @Get("client/repair-cases/:id/messages")
  @UseGuards(JwtAuthGuard)
  async listClientMessages(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    await this.repairCases.getForClient(id, user!.id); // controle d'appartenance
    return this.repairCases.listNotesForClient(id);
  }

  @Get("staff/repair-cases/scan/:rawQrToken")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.ORDER_READ)
  scanQrCode(@Param("rawQrToken") rawQrToken: string) {
    return this.repairCases.getByQrToken(rawQrToken);
  }

  @Post("staff/repair-cases/:id/qr/regenerate")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.REPAIR_ASSIGN)
  regenerateQr(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.repairCases.regenerateQrToken(id, { userId: user!.id, correlationId: randomUUID() });
  }

  @Post("staff/repair-cases/:id/qr/revoke")
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.REPAIR_ASSIGN)
  async revokeQr(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    await this.repairCases.revokeQrToken(id, { userId: user!.id, correlationId: randomUUID() });
    return { message: "QR revoque." };
  }
}
