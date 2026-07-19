import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard, type RequestWithUser } from "../guards/jwt-auth.guard.js";
import { CurrentUser } from "../decorators/current-user.decorator.js";
import { UserRepository } from "../repositories/user.repository.js";
import { NotFoundDomainError } from "../../core/errors/domain-error.js";
import type { AuthenticatedUserDto } from "@smc/contracts";
import { AuthenticatedUserResponseDto } from "../swagger/auth.swagger-dto.js";

@ApiTags("profile")
@Controller("profile")
export class ProfileController {
  constructor(private readonly users: UserRepository) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: AuthenticatedUserResponseDto })
  async me(@CurrentUser() current: RequestWithUser["currentUser"]): Promise<AuthenticatedUserDto> {
    const user = await this.users.findById(current!.id);
    if (!user) throw new NotFoundDomainError("Utilisateur introuvable.");
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      accountType: user.accountType,
    };
  }

  // Export et suppression des donnees personnelles (RGPD) : le point
  // d'integration est prevu ici. L'implementation complete (generation
  // asynchrone d'une archive, workflow de suppression differee pour
  // respecter les obligations legales de conservation des factures)
  // est prevue en phase suivante et n'est volontairement pas simulee.
}
