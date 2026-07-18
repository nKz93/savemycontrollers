import { SetMetadata } from "@nestjs/common";
import type { PermissionKey } from "../constants/permissions.js";

export const REQUIRE_ANY_PERMISSION_KEY = "require_any_permission";
export const REQUIRE_ALL_PERMISSIONS_KEY = "require_all_permissions";

/**
 * Decorateurs appliques sur un controleur/handler NestJS. La verification
 * effective est faite exclusivement cote serveur par PermissionGuard ; le
 * frontend peut adapter l'affichage mais ne constitue jamais la seule
 * barriere de securite (voir section 23 de l'architecture).
 *
 * Deux decorateurs distincts pour lever toute ambiguite (voir section 17
 * du prompt de phase 2C.1) :
 *  - `@RequirePermission(...)` : AU MOINS UNE des permissions listees
 *    suffit (logique OR). C'est le comportement historique de ce
 *    decorateur, conserve pour la compatibilite des routes existantes.
 *  - `@RequireAllPermissions(...)` : TOUTES les permissions listees sont
 *    necessaires (logique AND), a utiliser explicitement la ou c'est le
 *    comportement voulu.
 */
export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSION_KEY, permissions);

export const RequireAllPermissions = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRE_ALL_PERMISSIONS_KEY, permissions);
