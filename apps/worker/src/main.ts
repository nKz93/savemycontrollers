import { getPrismaClient, claimOutboxBatchAtomic, releaseStaleOutboxLocks } from "@smc/database";
import { createLogger } from "@smc/logger";
import { randomUUID } from "node:crypto";
import { handleOutboxEvent } from "./handlers/outbox-event-handler.js";

/**
 * Boucle de consommation de l'Outbox. La logique SQL de prise atomique
 * (`FOR UPDATE SKIP LOCKED`) vit dans `@smc/database` (voir
 * `claimOutboxBatchAtomic`), partagee avec l'API pour eviter toute
 * divergence entre les deux implementations (voir ADR-017).
 */
const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 20);
const MAX_ATTEMPTS = Number(process.env.OUTBOX_MAX_ATTEMPTS ?? 5);
const STALE_LOCK_MS = Number(process.env.OUTBOX_STALE_LOCK_MS ?? 5 * 60_000);

if (!Number.isFinite(POLL_INTERVAL_MS) || POLL_INTERVAL_MS < 100) {
  throw new Error("OUTBOX_POLL_INTERVAL_MS invalide (minimum 100ms).");
}
if (!Number.isFinite(BATCH_SIZE) || BATCH_SIZE < 1 || BATCH_SIZE > 500) {
  throw new Error("OUTBOX_BATCH_SIZE invalide (1 a 500).");
}
if (!Number.isFinite(MAX_ATTEMPTS) || MAX_ATTEMPTS < 1) {
  throw new Error("OUTBOX_MAX_ATTEMPTS invalide (minimum 1).");
}

const WORKER_ID = `${process.pid}-${randomUUID().slice(0, 8)}`;
const logger = createLogger({ serviceName: "smc-worker" });
const prisma = getPrismaClient();

let running = true;
let currentLoopPromise: Promise<void> | undefined;

async function claimAndProcessBatch(): Promise<void> {
  const rows = await claimOutboxBatchAtomic(prisma, BATCH_SIZE, WORKER_ID);

  for (const row of rows) {
    try {
      await handleOutboxEvent(row, logger);
      // Marquage terminal conditionnel : verifie que CE worker detient
      // toujours le verrou avant de marquer PROCESSED, pour qu'un worker
      // dont le bail a expire (repris par un autre apres
      // OUTBOX_STALE_LOCK_MS) ne puisse jamais ecraser le travail d'un
      // worker plus recent (voir section 18 du prompt de phase 2C).
      const result = await prisma.outboxEvent.updateMany({
        where: { id: row.id, status: "PROCESSING", lockedBy: WORKER_ID },
        data: { status: "PROCESSED", processedAt: new Date(), lockedAt: null, lockedBy: null },
      });
      if (result.count === 0) {
        logger.warn({ eventId: row.id, workerId: WORKER_ID }, "Verrou perdu avant la fin du traitement : marquage ignore (repris par un autre worker).");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      const attempts = row.attempts;
      if (attempts >= MAX_ATTEMPTS) {
        await prisma.outboxEvent.updateMany({
          where: { id: row.id, lockedBy: WORKER_ID },
          data: { status: "FAILED", lastError: message, lockedAt: null, lockedBy: null },
        });
        logger.error({ eventId: row.id, error: message, attempts }, "Evenement Outbox place en dead-letter (nombre maximal de tentatives atteint)");
      } else {
        const backoffSeconds = Math.min(2 ** attempts * 2, 3600);
        await prisma.outboxEvent.updateMany({
          where: { id: row.id, lockedBy: WORKER_ID },
          data: {
            status: "PENDING",
            lastError: message,
            lockedAt: null,
            lockedBy: null,
            nextAttemptAt: new Date(Date.now() + backoffSeconds * 1000),
          },
        });
        logger.warn({ eventId: row.id, error: message, attempts, backoffSeconds }, "Echec de traitement, nouvelle tentative planifiee (backoff exponentiel)");
      }
    }
  }
}

async function loop(): Promise<void> {
  logger.info({ pollIntervalMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE, workerId: WORKER_ID }, "Worker SaveMyControllers demarre");
  while (running) {
    try {
      const released = await releaseStaleOutboxLocks(prisma, STALE_LOCK_MS);
      if (released > 0) logger.warn({ count: released }, "Verrous perimes liberes (worker probablement mort sans liberer proprement)");
      await claimAndProcessBatch();
    } catch (error) {
      logger.error({ error }, "Erreur inattendue dans la boucle du worker");
    }
    if (running) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Arret demande : fin de la boucle en cours puis fermeture propre");
  running = false;
  await currentLoopPromise;
  await prisma.$disconnect();
  logger.info("Worker arrete proprement.");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

currentLoopPromise = loop();
currentLoopPromise.catch((error) => {
  logger.error({ error }, "Le worker s'est arrete de maniere inattendue");
  process.exit(1);
});
