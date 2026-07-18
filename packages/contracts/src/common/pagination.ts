import { z } from "zod";

/**
 * Contrat de pagination standard utilise par toutes les listes de l'API.
 * Le frontend ne doit jamais recevoir de forme de pagination differente
 * d'un module a l'autre.
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
