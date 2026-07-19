import createClient from "openapi-fetch";
import type { paths } from "./generated/schema.js";

/**
 * Client HTTP reellement genere a partir du contrat OpenAPI de l'API
 * (voir apps/api/src/generate-openapi.spec.ts pour la generation du
 * contrat, et le script `generate` de ce package pour la regeneration des
 * types). Remplace l'ancien stub qui ne faisait que reexporter
 * @smc/contracts sans aucune verification de coherence avec l'API reelle.
 *
 * Usage :
 *   const client = createApiClient({ baseUrl: "http://localhost:3001" });
 *   const { data, error } = await client.POST("/auth/login", { body: { email, password } });
 */
export function createApiClient(options: { baseUrl: string }) {
  return createClient<paths>({ baseUrl: options.baseUrl, credentials: "include" });
}

export type { paths, components } from "./generated/schema.js";

// Les DTO partages restent disponibles pour les cas ou un type structurel
// (independant du contrat HTTP genere) est suffisant, par exemple pour
// typer un formulaire cote frontend avant tout appel reseau.
export * from "@smc/contracts";
