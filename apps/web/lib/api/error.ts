import type { ApiErrorResponse } from "@smc/api-client";

/**
 * Le format d'erreur de l'API est toujours {error: {code, message,
 * correlationId, details}} (voir HttpExceptionFilter et
 * @smc/contracts/common/error.ts). openapi-fetch type la reponse
 * d'erreur de facon large (les schemas d'erreur ne sont pas encore
 * declares route par route dans Swagger), donc cette fonction reste
 * defensive a l'execution plutot que de supposer une forme garantie par
 * les types.
 */
export function getApiErrorMessage(error: unknown, fallback = "Une erreur est survenue. Veuillez reessayer."): string {
  if (error && typeof error === "object" && "error" in error) {
    const inner = (error as ApiErrorResponse).error;
    if (inner && typeof inner === "object" && typeof inner.message === "string" && inner.message.length > 0) {
      return inner.message;
    }
  }
  return fallback;
}

export function getApiErrorCorrelationId(error: unknown): string | null {
  if (error && typeof error === "object" && "error" in error) {
    const inner = (error as ApiErrorResponse).error;
    if (inner && typeof inner.correlationId === "string") return inner.correlationId;
  }
  return null;
}
