import { Module } from "@nestjs/common";
import { RoleRepository } from "./repositories/role.repository.js";
import { AuthorizationService } from "./services/authorization.service.js";
import { PermissionGuard } from "./guards/permission.guard.js";
import { IdentityModule } from "../identity/identity.module.js";

@Module({
  imports: [IdentityModule],
  providers: [RoleRepository, AuthorizationService, PermissionGuard],
  exports: [AuthorizationService, PermissionGuard],
})
export class AuthorizationModule {}
