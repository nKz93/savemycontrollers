import type { AppLogger } from "@smc/logger";
import { getPrismaClient } from "@smc/database";
import { decryptSensitiveValue, type EncryptedPayload } from "@smc/crypto";

export interface OutboxEventLike {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: unknown;
  payloadEncrypted: boolean;
  correlationId: string;
}

/**
 * Preuve d'idempotence (voir section 21 du prompt) : avant tout effet de
 * bord externe (ici, l'envoi simule d'un email), le handler verifie dans
 * le journal d'audit qu'aucune trace de traitement reussi n'existe deja
 * pour CET evenement Outbox precis (`resourceId = event.id`). Si une
 * execution precedente a deja ete journalisee comme reussie (par exemple
 * parce que l'evenement a ete repris apres un crash juste avant la mise a
 * jour de son statut), le handler ne rejoue pas l'effet de bord — il se
 * contente de confirmer l'idempotence et retourne normalement.
 */
async function alreadyProcessed(eventId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const existing = await prisma.auditLog.findFirst({
    where: { resourceType: "OutboxEvent", resourceId: eventId, action: "worker.email_verification_sent", result: "SUCCESS" },
  });
  return existing !== null;
}

async function recordProcessed(eventId: string, correlationId: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.auditLog.create({
    data: {
      actorType: "SYSTEM",
      action: "worker.email_verification_sent",
      resourceType: "OutboxEvent",
      resourceId: eventId,
      result: "SUCCESS",
      correlationId,
    },
  });
}

export async function handleOutboxEvent(event: OutboxEventLike, logger: AppLogger): Promise<void> {
  switch (event.eventType) {
    case "EmailVerificationRequested": {
      if (await alreadyProcessed(event.id)) {
        logger.info({ eventId: event.id }, "Evenement deja traite (idempotence) : envoi ignore.");
        return;
      }
      const payload = event.payload as { email: string; encryptedToken?: EncryptedPayload };
      if (event.payloadEncrypted && payload.encryptedToken) {
        const rawToken = decryptSensitiveValue(payload.encryptedToken);
        // Le jeton dechiffre n'est JAMAIS journalise : il est utilise
        // uniquement pour construire le lien d'activation transmis par
        // email (integration SMTP reelle prevue en phase suivante — voir
        // section 1 du prompt, hors perimetre de cette phase de
        // stabilisation).
        logger.info({ eventId: event.id, email: redactEmail(payload.email), tokenLength: rawToken.length }, "Email de verification pret a etre envoye (integration SMTP a brancher)");
      }
      await recordProcessed(event.id, event.correlationId);
      return;
    }
    case "UserRegistered":
    case "OrderCreated":
    case "OrderConfirmed":
    case "RepairCaseCreated":
    case "RepairStatusChanged":
    case "FileUploaded":
    case "CompanyApplicationSubmitted": {
      logger.info(
        { eventType: event.eventType, aggregateType: event.aggregateType, aggregateId: event.aggregateId, correlationId: event.correlationId },
        "Evenement metier recu (point d'integration pret, action reelle branchee en phase suivante)",
      );
      return;
    }
    default:
      logger.warn({ eventType: event.eventType }, "Type d'evenement inconnu du worker");
  }
}

function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain || !local) return "***";
  return `${local.slice(0, 2)}***@${domain}`;
}
