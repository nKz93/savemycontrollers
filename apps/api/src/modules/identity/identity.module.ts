import { Module } from "@nestjs/common";
import { UserRepository } from "./repositories/user.repository.js";
import { SessionRepository } from "./repositories/session.repository.js";
import { VerificationTokenRepository } from "./repositories/verification-token.repository.js";
import { PasswordService } from "./services/password.service.js";
import { TokenService } from "./services/token.service.js";
import { AuthService } from "./services/auth.service.js";
import { AuthController } from "./controllers/auth.controller.js";
import { ProfileController } from "./controllers/profile.controller.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { IdentityPublicApi } from "./identity.public-api.js";
import { OutboxModule } from "../outbox/outbox.module.js";
import { AuditModule } from "../audit/audit.module.js";

@Module({
  imports: [OutboxModule, AuditModule],
  controllers: [AuthController, ProfileController],
  providers: [
    UserRepository,
    SessionRepository,
    VerificationTokenRepository,
    PasswordService,
    TokenService,
    AuthService,
    JwtAuthGuard,
    IdentityPublicApi,
  ],
  exports: [IdentityPublicApi, JwtAuthGuard, TokenService],
})
export class IdentityModule {}
