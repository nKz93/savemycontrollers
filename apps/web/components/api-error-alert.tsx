import { getApiErrorMessage } from "../lib/api/error.js";

/** Affichage uniforme d'une erreur API structuree (voir lib/api/error.ts). */
export function ApiErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="smc-alert smc-alert--error" role="alert">
      {getApiErrorMessage(error)}
    </div>
  );
}
