import { PrismaClient } from "@prisma/client";

/**
 * Point d'acces unique a Prisma. L'acces direct et global a PrismaClient
 * depuis un service metier est interdit (voir regle ESLint no-restricted-imports
 * et ADR-005). Chaque module NestJS injecte ce client uniquement au sein
 * de son propre repository/adaptateur de persistance.
 */
export * from "@prisma/client";

let sharedClient: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!sharedClient) {
    sharedClient = new PrismaClient({
      log: process.env.NODE_ENV === "production" ? ["error", "warn"] : ["error", "warn", "query"],
    });
  }
  return sharedClient;
}
export { claimOutboxBatchAtomic, releaseStaleOutboxLocks, nextReferenceSequence, type ClaimedOutboxRow } from "./outbox-claim.js";
