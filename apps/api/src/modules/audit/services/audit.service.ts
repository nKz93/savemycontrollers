import { Injectable } from "@nestjs/common";
import { AuditRepository } from "../repositories/audit.repository.js";

export interface AuditContext {
  actorUserId?: string;
  actorType: "USER" | "STAFF" | "SYSTEM";
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
}

/**
 * Point d'entree unique pour journaliser une action sensible. Le journal
 * est append-only : aucune methode de modification/suppression n'est
 * exposee ici volontairement (voir section 25 de l'architecture).
 *
 * Liste des actions couvertes des cette phase : connexion, changement de
 * permission, changement de statut de reparation, creation de commande.
 * D'autres actions (remboursement, installation d'extension...) seront
 * journalisees au fur et a mesure de l'implementation des modules
 * correspondants (phases suivantes).
 */
@Injectable()
export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  async record(
    context: AuditContext,
    entry: {
      action: string;
      resourceType: string;
      resourceId?: string;
      result: "SUCCESS" | "FAILURE";
      before?: Record<string, unknown>;
      after?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.repository.append({
      actorUserId: context.actorUserId,
      actorType: context.actorType,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      correlationId: context.correlationId,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      result: entry.result,
      beforeData: entry.before,
      afterData: entry.after,
    });
  }
}
