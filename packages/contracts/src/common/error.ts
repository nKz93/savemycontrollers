/**
 * Format d'erreur unique renvoye par l'API, quel que soit le module.
 * `correlationId` permet de retrouver la requete dans les logs et l'audit.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: Record<string, unknown>;
  };
}
