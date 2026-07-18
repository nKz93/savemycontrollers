import { Injectable } from "@nestjs/common";
import { getPrismaClient, claimOutboxBatchAtomic, type Prisma } from "@smc/database";
import type { BusinessEvent } from "../../core/events/business-event.js";

/**
 * Implementation du Outbox Pattern : l'ecriture d'un evenement se fait
 * toujours dans la meme transaction Prisma que la mutation metier qui le
 * declenche (voir usage dans modules/orders et modules/repairs). Le worker
 * (apps/worker) consomme ensuite ces lignes de facon idempotente.
 */
@Injectable()
export class OutboxRepository {
  private readonly prisma = getPrismaClient();

  /**
   * A appeler avec le `tx` (client transactionnel) d'une transaction Prisma
   * en cours, jamais avec le client global, pour garantir l'atomicite
   * ecriture-metier + evenement.
   */
  appendInTransaction(
    tx: Prisma.TransactionClient,
    event: BusinessEvent,
    options?: { encrypted?: boolean },
  ): Promise<{ id: string }> {
    return tx.outboxEvent.create({
      data: {
        eventType: event.eventType,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        payload: event.payload as Prisma.InputJsonValue,
        payloadEncrypted: options?.encrypted ?? false,
        correlationId: event.correlationId,
      },
      select: { id: true },
    });
  }

  claimPendingBatch(limit: number) {
    return this.prisma.outboxEvent.findMany({
      where: { status: "PENDING" },
      orderBy: { occurredAt: "asc" },
      take: limit,
    });
  }

  /**
   * Prise de lot atomique : deja implementee dans @smc/database
   * (partagee avec le worker, voir section 3 de la phase 2C) — cette
   * methode delegue simplement, pour que l'API dispose du meme
   * comportement si elle a besoin de traiter des evenements elle-meme.
   */
  async claimBatchAtomic(limit: number, workerId: string) {
    return claimOutboxBatchAtomic(this.prisma, limit, workerId);
  }

  /** Backoff exponentiel plafonne, applique lorsqu'un evenement echoue et sera reessaye. */
  markPendingWithBackoff(id: string, error: string, attempts: number): Promise<{ id: string }> {
    const backoffSeconds = Math.min(2 ** attempts * 2, 3600); // plafond a 1h
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: "PENDING",
        lastError: error,
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt: new Date(Date.now() + backoffSeconds * 1000),
      },
      select: { id: true },
    });
  }

  /** Recuperation d'un evenement bloque (worker mort sans liberer son verrou) apres expiration. */
  releaseStaleLocks(staleAfterMs: number): Promise<{ count: number }> {
    return this.prisma.outboxEvent.updateMany({
      where: { status: "PROCESSING", lockedAt: { lt: new Date(Date.now() - staleAfterMs) } },
      data: { status: "PENDING", lockedAt: null, lockedBy: null },
    });
  }

  markProcessing(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: "PROCESSING", attempts: { increment: 1 } },
    });
  }

  markProcessed(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: new Date(), lockedAt: null, lockedBy: null },
    });
  }

  /** Etat terminal "dead-letter" : attempts >= max, ne sera plus jamais repris automatiquement. */
  markDeadLetter(id: string, error: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: "FAILED", lastError: error, lockedAt: null, lockedBy: null },
    });
  }

  markFailed(id: string, error: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: { status: "FAILED", lastError: error },
    });
  }

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
