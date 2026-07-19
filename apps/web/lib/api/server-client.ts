import { cookies } from "next/headers";
import { createApiClient } from "@smc/api-client";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

/**
 * Client API pour les composants et actions serveur (lecture
 * essentiellement — voir browser-client.ts pour les mutations, qui
 * passent par le navigateur afin de simplifier la gestion CSRF). Les
 * cookies de la requete entrante (access token HttpOnly notamment) sont
 * transmis manuellement en en-tete `Cookie` : le `fetch` cote serveur
 * Next.js n'a pas de pot de cookies navigateur et ne les propage jamais
 * automatiquement vers un domaine externe (apps/api tourne sur un port
 * distinct).
 *
 * Une nouvelle instance est creee a CHAQUE appel (pas de singleton
 * module-level) car les cookies de la requete entrante different d'une
 * requete HTTP a l'autre sur le serveur Next.js.
 */
export function createServerApiClient() {
  const cookieHeader = cookies()
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const client = createApiClient({ baseUrl: API_URL });
  client.use({
    onRequest({ request }) {
      if (cookieHeader) request.headers.set("Cookie", cookieHeader);
      return request;
    },
  });
  return client;
}
