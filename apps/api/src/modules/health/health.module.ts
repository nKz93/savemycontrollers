import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller.js";
import { HealthInternalController } from "./health-internal.controller.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { IdentityModule } from "../identity/identity.module.js";

@Module({
  imports: [AuthorizationModule, IdentityModule],
  controllers: [HealthController, HealthInternalController],
})
export class HealthModule {}
