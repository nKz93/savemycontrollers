import type { PrismaClient, Prisma } from "@prisma/client";

export interface ClaimedOutboxRow {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  payloadEncrypted: boolean;
  correlationId: string;
  attempts: number;
}

/**
 * Prise de lot atomique d'evenements Outbox (voir ADR-017), partagee entre
 * l'API et le worker pour eviter toute divergence de la requete SQL brute
 * (voir section 3 du prompt de phase 2C : "ne duplique pas la logique SQL
 * de prise d'evenements dans l'API et le worker"). Les noms de colonnes
 * utilises ici correspondent exactement aux `@map(...)` du schema Prisma
 * (voir prisma/schema.prisma, modele OutboxEvent).
 */
export async function claimOutboxBatchAtomic(
  prisma: PrismaClient,
  limit: number,
  workerId: string,
): Promise<ClaimedOutboxRow[]> {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        event_type: string;
        aggregate_type: string;
        aggregate_id: string;
        payload: unknown;
        payload_encrypted: boolean;
        correlation_id: string;
        attempts: number;
      }>
    >`
      SELECT id, event_type, aggregate_type, aggregate_id, payload, payload_encrypted, correlation_id, attempts
      FROM outbox_events
      WHERE status = 'PENDING' AND next_attempt_at <= NOW()
      ORDER BY occurred_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED;
    `;
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.id);
    await tx.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { status: "PROCESSING", lockedAt: new Date(), lockedBy: workerId, attempts: { increment: 1 } },
    });

    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      aggregateType: r.aggregate_type,
      aggregateId: r.aggregate_id,
      payload: r.payload,
      payloadEncrypted: r.payload_encrypted,
      correlationId: r.correlation_id,
      attempts: r.attempts,
    }));
  });
}

/** Recuperation d'un evenement bloque (worker mort sans liberer son verrou) apres expiration du bail. */
export async function releaseStaleOutboxLocks(prisma: PrismaClient, staleAfterMs: number): Promise<number> {
  const result = await prisma.outboxEvent.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: new Date(Date.now() - staleAfterMs) } },
    data: { status: "PENDING", lockedAt: null, lockedBy: null },
  });
  return result.count;
}

/** Genere la prochaine reference commerciale d'un perimetre donne (voir ADR-012), via compteur atomique. */
export async function nextReferenceSequence(
  prisma: PrismaClient,
  scope: string,
): Promise<{ year: number; value: number }> {
  const year = new Date().getUTCFullYear();
  const rows = await prisma.$queryRaw<Array<{ last_value: number }>>`
    INSERT INTO reference_counters (scope, year, last_value)
    VALUES (${scope}, ${year}, 1)
    ON CONFLICT (scope, year)
    DO UPDATE SET last_value = reference_counters.last_value + 1
    RETURNING last_value;
  `;
  const lastValue = rows[0]?.last_value;
  if (lastValue === undefined) {
    throw new Error(`Echec de generation de reference pour le perimetre "${scope}".`);
  }
  if (lastValue > 999999) {
    throw new Error(`Compteur de reference "${scope}" epuise pour l'annee ${year}.`);
  }
  return { year, value: lastValue };
}
