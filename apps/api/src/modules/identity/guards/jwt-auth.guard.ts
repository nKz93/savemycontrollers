import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { TokenService } from "../services/token.service.js";

export interface RequestWithUser extends Request {
  currentUser?: { id: string; accountType: string };
}

/**
 * L'access token est transmis via cookie HttpOnly (voir auth.controller.ts),
 * jamais lu depuis localStorage cote frontend. Ce guard est la seule source
 * de verite pour identifier l'utilisateur courant ; les autres guards
 * (permissions) s'appuient sur `request.currentUser`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = request.cookies?.["smc_access_token"] as string | undefined;
    if (!token) throw new UnauthorizedException("Authentification requise.");
    try {
      const claims = this.tokens.verifyAccessToken(token);
      request.currentUser = { id: claims.sub, accountType: claims.accountType };
      return true;
    } catch {
      throw new UnauthorizedException("Session invalide ou expiree.");
    }
  }
}
