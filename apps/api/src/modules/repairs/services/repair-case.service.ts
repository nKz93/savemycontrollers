import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@smc/database";
import { RepairCaseRepository } from "../repositories/repair-case.repository.js";
import { RepairStatusRepository } from "../repositories/repair-status.repository.js";
import { RepairHistoryRepository } from "../repositories/repair-history.repository.js";
import { RepairNoteRepository } from "../repositories/repair-note.repository.js";
import { ReferenceGeneratorService } from "../../core/services/reference-generator.service.js";
import { QrTokenService } from "./qr-token.service.js";
import { AuditService } from "../../audit/services/audit.service.js";
import { OutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import { BUSINESS_EVENT_TYPES } from "../../core/events/business-event.js";
import { IdentityPublicApi } from "../../identity/identity.public-api.js";
import { AuthorizationService } from "../../authorization/services/authorization.service.js";
import { PERMISSIONS } from "../../authorization/constants/permissions.js";
import {
  ConflictDomainError,
  ForbiddenDomainError,
  NotFoundDomainError,
  OptimisticLockDomainError,
  ValidationDomainError,
} from "../../core/errors/domain-error.js";

export const REPAIR_STATUS_KEYS = {
  ORDER_CREATED: "ORDER_CREATED",
  AWAITING_SHIPMENT: "AWAITING_SHIPMENT",
  RECEIVED: "RECEIVED",
  DIAGNOSING: "DIAGNOSING",
  AWAITING_CLIENT_VALIDATION: "AWAITING_CLIENT_VALIDATION",
  AWAITING_PART: "AWAITING_PART",
  IN_REPAIR: "IN_REPAIR",
  QUALITY_CHECK: "QUALITY_CHECK",
  REPAIR_DONE: "REPAIR_DONE",
  PREPARING_RETURN: "PREPARING_RETURN",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CLOSED: "CLOSED",
  UNREPAIRABLE: "UNREPAIRABLE",
  QUOTE_REFUSED: "QUOTE_REFUSED",
  CLIENT_UNREACHABLE: "CLIENT_UNREACHABLE",
  CANCELLED: "CANCELLED",
  WARRANTY_RETURN: "WARRANTY_RETURN",
} as const;

interface CreateCaseInput {
  orderId: string;
  orderItemId: string;
  clientId?: string;
  companyId?: string;
  deviceModelId: string;
  deviceVariantId: string;
  hardwareRevisionId?: string;
  reportedIssue?: string;
}

@Injectable()
export class RepairCaseService {
  constructor(
    private readonly cases: RepairCaseRepository,
    private readonly statuses: RepairStatusRepository,
    private readonly history: RepairHistoryRepository,
    private readonly notes: RepairNoteRepository,
    private readonly references: ReferenceGeneratorService,
    private readonly qrTokens: QrTokenService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxRepository,
    private readonly identity: IdentityPublicApi,
    private readonly authorization: AuthorizationService,
  ) {}

  /**
   * Appele depuis la meme transaction que la creation de la commande
   * (voir modules/orders). Un appareil commande = un dossier de reparation
   * (voir section 13 de l'architecture). Le jeton QR brut n'est jamais
   * persiste : il est retourne une seule fois ici pour permettre son
   * impression immediate sur le bordereau (voir ADR-009 et ADR-022).
   */
  async createCasesForOrderInTransaction(
    tx: Prisma.TransactionClient,
    items: CreateCaseInput[],
    correlationId: string,
  ): Promise<{ id: string; reference: string; rawQrToken: string }[]> {
    const created: { id: string; reference: string; rawQrToken: string }[] = [];
    for (const item of items) {
      const { rawToken, tokenHash } = this.qrTokens.generate();
      const reference = await this.references.generateRepairCaseReference();
      const repairCase = await tx.repairCase.create({
        data: {
          reference,
          qrTokenHash: tokenHash,
          orderId: item.orderId,
          orderItemId: item.orderItemId,
          clientId: item.clientId,
          companyId: item.companyId,
          deviceModelId: item.deviceModelId,
          deviceVariantId: item.deviceVariantId,
          hardwareRevisionId: item.hardwareRevisionId,
          reportedIssue: item.reportedIssue,
          statusKey: REPAIR_STATUS_KEYS.ORDER_CREATED,
        },
      });
      await tx.repairStatusHistory.create({
        data: { repairCaseId: repairCase.id, statusKey: REPAIR_STATUS_KEYS.ORDER_CREATED },
      });
      await this.outbox.appendInTransaction(tx, {
        eventType: BUSINESS_EVENT_TYPES.REPAIR_CASE_CREATED,
        aggregateType: "RepairCase",
        aggregateId: repairCase.id,
        payload: { reference: repairCase.reference, orderId: item.orderId },
        correlationId,
      });
      created.push({ id: repairCase.id, reference: repairCase.reference, rawQrToken: rawToken });
    }
    return created;
  }

  async getForClient(id: string, clientId: string) {
    const repairCase = await this.cases.findById(id);
    if (!repairCase) throw new NotFoundDomainError("Dossier introuvable.");
    if (repairCase.clientId !== clientId) {
      // Un client ne doit jamais pouvoir consulter le dossier d'un autre client.
      throw new ForbiddenDomainError("Acces refuse a ce dossier.");
    }
    return repairCase;
  }

  async getForStaff(id: string) {
    const repairCase = await this.cases.findById(id);
    if (!repairCase) throw new NotFoundDomainError("Dossier introuvable.");
    return repairCase;
  }

  /** Scan atelier : uniquement accessible a un technicien deja authentifie (voir controleur, guard applique en amont). */
  async getByQrToken(rawToken: string) {
    const tokenHash = this.qrTokens.hash(rawToken);
    const repairCase = await this.cases.findByQrTokenHash(tokenHash);
    if (!repairCase) throw new NotFoundDomainError("Dossier introuvable ou QR revoque.");
    return repairCase;
  }

  async regenerateQrToken(repairCaseId: string, actor: { userId: string; correlationId: string }) {
    const repairCase = await this.cases.findById(repairCaseId);
    if (!repairCase) throw new NotFoundDomainError("Dossier introuvable.");
    const { rawToken, tokenHash } = this.qrTokens.generate();
    await this.cases.regenerateQrToken(repairCaseId, tokenHash);
    await this.audit.record(
      { actorUserId: actor.userId, actorType: "STAFF", correlationId: actor.correlationId },
      { action: "repair_case.qr_regenerated", resourceType: "RepairCase", resourceId: repairCaseId, result: "SUCCESS" },
    );
    // Le jeton brut n'est retourne qu'une seule fois, pour reimpression immediate du bordereau.
    return { rawQrToken: rawToken };
  }

  async revokeQrToken(repairCaseId: string, actor: { userId: string; correlationId: string }): Promise<void> {
    const repairCase = await this.cases.findById(repairCaseId);
    if (!repairCase) throw new NotFoundDomainError("Dossier introuvable.");
    await this.cases.revokeQrToken(repairCaseId);
    await this.audit.record(
      { actorUserId: actor.userId, actorType: "STAFF", correlationId: actor.correlationId },
      { action: "repair_case.qr_revoked", resourceType: "RepairCase", resourceId: repairCaseId, result: "SUCCESS" },
    );
  }

  async listForClient(clientId: string) {
    return this.cases.listForClient(clientId);
  }

  /**
   * Changement de statut entierement atomique (voir section 16 du prompt et
   * ADR-021) : le controle du verrou optimiste, la modification du statut,
   * l'ecriture de l'historique et l'evenement Outbox sont regroupes dans
   * une seule transaction PostgreSQL. Si l'ecriture de l'evenement Outbox
   * echoue, le changement de statut et son historique sont annules
   * (rollback complet), garantissant qu'aucun etat partiel n'est
   * enregistre.
   *
   * Compromis assume : l'ecriture du journal d'audit reste hors de cette
   * transaction (elle utilise sa propre connexion via AuditService). Une
   * defaillance de l'audit APRES le commit de la transaction metier
   * n'annule donc pas le changement de statut deja acquis — un changement
   * de statut reussi ne doit jamais etre perdu a cause d'un probleme
   * d'ecriture du journal, qui est un mecanisme d'observabilite et non une
   * condition de validite metier. Ce choix est documente et assume, pas un
   * oubli (voir ADR-021 pour la discussion complete).
   */
  async changeStatus(
    repairCaseId: string,
    toStatusKey: string,
    actor: { userId: string; correlationId: string; ipAddress?: string; userAgent?: string },
    comment?: string,
  ) {
    const repairCase = await this.cases.findById(repairCaseId);
    if (!repairCase) throw new NotFoundDomainError("Dossier introuvable.");

    const targetStatus = await this.statuses.findStatus(toStatusKey);
    if (!targetStatus) throw new ValidationDomainError("Statut cible inconnu.");

    const transitionAllowed = await this.statuses.isTransitionAllowed(repairCase.statusKey, toStatusKey);
    if (!transitionAllowed) {
      throw new ConflictDomainError(
        `Transition non autorisee de "${repairCase.statusKey}" vers "${toStatusKey}".`,
      );
    }

    const fromStatusKey = repairCase.statusKey;

    await this.cases.runInTransaction(async (tx) => {
      const result = await this.cases.updateStatusWithOptimisticLockInTransaction(
        tx,
        repairCaseId,
        repairCase.lockVersion,
        toStatusKey,
      );
      if (result.count === 0) {
        // Le dossier a ete modifie entre-temps par un autre utilisateur :
        // leve une erreur DANS la transaction pour provoquer un rollback
        // complet (aucun historique ni evenement partiellement ecrit).
        throw new OptimisticLockDomainError("Le dossier a ete modifie entre-temps, veuillez recharger.");
      }

      await this.cases.appendHistoryInTransaction(tx, {
        repairCaseId,
        statusKey: toStatusKey,
        changedByUserId: actor.userId,
        comment,
      });

      await this.outbox.appendInTransaction(tx, {
        eventType: BUSINESS_EVENT_TYPES.REPAIR_STATUS_CHANGED,
        aggregateType: "RepairCase",
        aggregateId: repairCaseId,
        payload: { fromStatusKey, toStatusKey },
        correlationId: actor.correlationId,
      });
    });

    await this.audit.record(
      { actorUserId: actor.userId, actorType: "STAFF", correlationId: actor.correlationId, ipAddress: actor.ipAddress, userAgent: actor.userAgent },
      {
        action: "repair_case.status_changed",
        resourceType: "RepairCase",
        resourceId: repairCaseId,
        result: "SUCCESS",
        before: { statusKey: fromStatusKey },
        after: { statusKey: toStatusKey },
      },
    );

    return this.cases.findById(repairCaseId);
  }

  /**
   * Verifications completes avant affectation (voir section 17 du
   * prompt) : existence, statut actif, appartenance au personnel
   * SaveMyControllers (jamais un client particulier), et possession d'un
   * role autorise (verifie via une permission representative du metier
   * technicien).
   */
  async assignTechnician(repairCaseId: string, technicianId: string, actor: { userId: string; correlationId: string }) {
    const repairCase = await this.cases.findById(repairCaseId);
    if (!repairCase) throw new NotFoundDomainError("Dossier introuvable.");

    const staffProfile = await this.identity.getStaffProfileForAssignment(technicianId);
    if (!staffProfile) throw new NotFoundDomainError("Technicien introuvable.");
    if (!staffProfile.isActive) throw new ValidationDomainError("Ce compte est desactive.");
    if (staffProfile.accountType !== "STAFF") {
      throw new ForbiddenDomainError("Seul un membre du personnel SaveMyControllers peut etre affecte a un dossier.");
    }
    const hasAuthorizedRole = await this.authorization.hasAnyPermission(technicianId, [
      PERMISSIONS.REPAIR_DIAGNOSE,
      PERMISSIONS.REPAIR_CHANGE_STATUS,
    ]);
    if (!hasAuthorizedRole) {
      throw new ForbiddenDomainError("Ce membre du personnel ne possede pas de role autorise pour les reparations.");
    }

    const updated = await this.cases.assignTechnician(repairCaseId, technicianId);
    await this.audit.record(
      { actorUserId: actor.userId, actorType: "STAFF", correlationId: actor.correlationId },
      { action: "repair_case.technician_assigned", resourceType: "RepairCase", resourceId: repairCaseId, result: "SUCCESS", after: { technicianId } },
    );
    return updated;
  }

  async addInternalNote(repairCaseId: string, authorUserId: string, body: string) {
    return this.notes.create({ repairCaseId, authorUserId, visibility: "INTERNAL", body });
  }

  async addClientMessage(repairCaseId: string, authorUserId: string | undefined, body: string) {
    return this.notes.create({ repairCaseId, authorUserId, visibility: "CLIENT", body });
  }

  async listNotesForClient(repairCaseId: string) {
    return this.notes.listForCase(repairCaseId, ["CLIENT"]);
  }

  async listNotesForStaff(repairCaseId: string) {
    return this.notes.listForCase(repairCaseId, ["INTERNAL", "CLIENT"]);
  }

  correlationId(): string {
    return randomUUID();
  }
}
