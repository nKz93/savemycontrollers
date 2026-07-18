import type { PaginatedResult, PaginationQuery } from "@smc/contracts";

/**
 * Construit un resultat pagine standard a partir d'une requete Prisma
 * (count + findMany). Utilise par tous les modules pour ne jamais diverger
 * du contrat @smc/contracts PaginatedResult.
 */
export function toPaginatedResult<T>(
  items: T[],
  totalItems: number,
  query: PaginationQuery,
): PaginatedResult<T> {
  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / query.pageSize)),
  };
}

export function toSkipTake(query: PaginationQuery): { skip: number; take: number } {
  return { skip: (query.page - 1) * query.pageSize, take: query.pageSize };
}
