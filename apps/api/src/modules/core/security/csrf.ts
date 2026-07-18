import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";

/**
 * Protection CSRF par double-soumission de cookie (voir ADR-019). Aucune
 * valeur de secours n'est autorisee (voir ADR-018) : `CSRF_SECRET` est
 * obligatoire, valide par `validateEnv()` avant l'appel a cette fonction.
 */
export function createCsrfProtection(csrfSecret: string) {
  if (!csrfSecret) {
    throw new Error("CSRF_SECRET est obligatoire : aucune valeur de secours n'est autorisee.");
  }
  return doubleCsrf({
    getSecret: () => csrfSecret,
    cookieName: process.env.NODE_ENV === "production" ? "__Host-smc.csrf" : "smc.csrf",
    cookieOptions: {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    getSessionIdentifier: (req: Request) => (req.cookies?.["smc_access_token"] as string | undefined) ?? "anonymous",
    getTokenFromRequest: (req: Request) => req.headers["x-csrf-token"] as string | undefined,
  });
}
