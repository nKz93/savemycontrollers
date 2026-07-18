import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { RequestWithUser } from "../../identity/guards/jwt-auth.guard.js";
import { AuthorizationService } from "../services/authorization.service.js";
import { IdentityPublicApi } from "../../identity/identity.public-api.js";
import { REQUIRE_ANY_PERMISSION_KEY, REQUIRE_ALL_PERMISSIONS_KEY } from "../decorators/require-permission.decorator.js";
import type { PermissionKey } from "../constants/permissions.js";

/**
 * Doit toujours etre applique APRES JwtAuthGuard (qui peuple
 * request.currentUser). Un handler sans @RequirePermission ni
 * @RequireAllPermissions n'est pas protege par ce guard : ne pas oublier
 * de l'ajouter explicitement sur chaque route sensible.
 *
 * Verifie desormais, avant toute evaluation de permission (voir section
 * 22/17 du prompt) : le compte existe encore, est actif, et est bien de
 * type STAFF. Une ligne UserRole attribuee par erreur (ou restee apres
 * une desactivation) a un compte client ne suffit jamais a elle seule a
 * ouvrir une route du personnel.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
    private readonly identity: IdentityPublicApi,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const anyOf = this.reflector.getAllAndOverride<PermissionKey[]>(REQUIRE_ANY_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allOf = this.reflector.getAllAndOverride<PermissionKey[]>(REQUIRE_ALL_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const hasAnyRequirement = anyOf && anyOf.length > 0;
    const hasAllRequirement = allOf && allOf.length > 0;
    if (!hasAnyRequirement && !hasAllRequirement) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (!request.currentUser) throw new ForbiddenException("Authentification requise.");

    const staffProfile = await this.identity.getStaffProfileForAssignment(request.currentUser.id);
    if (!staffProfile || !staffProfile.isActive || staffProfile.accountType !== "STAFF") {
      // Le compte a pu etre desactive ou supprime depuis l'emission de
      // l'access token (jusqu'a 15 minutes de duree de vie par defaut) :
      // on ne fait jamais confiance uniquement au contenu du JWT pour les
      // routes du personnel.
      throw new ForbiddenException("Acces reserve au personnel SaveMyControllers actif.");
    }

    if (hasAllRequirement) {
      const allowed = await this.authorization.hasAllPermissions(request.currentUser.id, allOf);
      if (!allowed) throw new ForbiddenException("Permissions insuffisantes.");
    }
    if (hasAnyRequirement) {
      const allowed = await this.authorization.hasAnyPermission(request.currentUser.id, anyOf);
      if (!allowed) throw new ForbiddenException("Permission insuffisante.");
    }
    return true;
  }
}
