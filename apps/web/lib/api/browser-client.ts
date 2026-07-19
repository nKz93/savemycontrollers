"use client";

import { createApiClient } from "@smc/api-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

let cachedCsrfToken: string | null = null;
let csrfFetchPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (!csrfFetchPromise) {
    csrfFetchPromise = fetch(`${API_URL}/csrf-token`, { credentials: "include" })
      .then((res) => res.json() as Promise<{ csrfToken: string }>)
      .then((body) => {
        cachedCsrfToken = body.csrfToken;
        return body.csrfToken;
      })
      .finally(() => {
        csrfFetchPromise = null;
      });
  }
  return csrfFetchPromise;
}

/** Invalide le jeton CSRF en cache (ex. apres une connexion/deconnexion qui renouvelle le cookie). */
export function resetCsrfToken(): void {
  cachedCsrfToken = null;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Client API pour les composants client (navigateur). Attache
 * automatiquement le jeton CSRF (double soumission cookie/en-tete, voir
 * ADR-019) sur toute requete mutante — aucun composant n'a besoin de s'en
 * soucier individuellement. `credentials: "include"` est deja configure
 * par createApiClient pour transmettre les cookies HttpOnly de session.
 */
export const api = createApiClient({ baseUrl: API_URL });

api.use({
  async onRequest({ request }) {
    if (MUTATING_METHODS.has(request.method)) {
      const token = await getCsrfToken();
      request.headers.set("X-CSRF-Token", token);
    }
    return request;
  },
});
