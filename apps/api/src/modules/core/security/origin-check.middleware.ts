import type { NextFunction, Request, Response } from "express";
import { ForbiddenException } from "@nestjs/common";

/**
 * Verification defensive complementaire au CSRF : sur toute requete
 * mutative (POST/PUT/PATCH/DELETE), l'en-tete Origin (ou Referer a defaut)
 * doit correspondre a une origine autorisee. Cette verification est
 * volontairement simple et ne remplace pas le jeton CSRF — elle bloque des
 * classes d'attaques ou l'en-tete CSRF pourrait etre rejoue depuis un
 * contexte inattendu.
 */
export function createOriginCheckMiddleware(allowedOrigins: string[]) {
  const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);
  return function originCheckMiddleware(req: Request, _res: Response, next: NextFunction): void {
    if (!mutatingMethods.has(req.method)) {
      next();
      return;
    }
    const origin = req.headers.origin ?? extractOriginFromReferer(req.headers.referer);
    if (!origin) {
      // Pas d'en-tete Origin/Referer : typique d'un appel non-navigateur
      // (ex. outil interne, tests). Laisse passer ici, la protection CSRF
      // (jeton) reste la barriere principale pour les navigateurs.
      next();
      return;
    }
    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException("Origine de la requete non autorisee.");
    }
    next();
  };
}

function extractOriginFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}
