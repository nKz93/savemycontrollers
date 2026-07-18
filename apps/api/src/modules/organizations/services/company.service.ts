import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CompanyRepository } from "../repositories/company.repository.js";
import { OutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import { BUSINESS_EVENT_TYPES } from "../../core/events/business-event.js";
import { getPrismaClient } from "@smc/database";
import { ForbiddenDomainError } from "../../core/errors/domain-error.js";

/**
 * La demande de compte professionnel est creee au statut PENDING et
 * necessite une validation manuelle (voir section 11 de l'architecture).
 * Aucune activation automatique n'est prevue : c'est une decision commerciale
 * volontairement humaine.
 */
@Injectable()
export class CompanyService {
  private readonly prisma = getPrismaClient();

  constructor(private readonly companies: CompanyRepository, private readonly outbox: OutboxRepository) {}

  async submitApplication(input: { name: string; siret?: string; vatNumber?: string; ownerUserId: string }) {
    const correlationId = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: input.name,
          siret: input.siret,
          vatNumber: input.vatNumber,
          members: { create: { userId: input.ownerUserId, internalRole: "OWNER" } },
        },
      });
      await this.outbox.appendInTransaction(tx, {
        eventType: BUSINESS_EVENT_TYPES.COMPANY_APPLICATION_SUBMITTED,
        aggregateType: "Company",
        aggregateId: company.id,
        payload: { name: company.name },
        correlationId,
      });
      return company;
    });
  }

  async assertMember(companyId: string, userId: string): Promise<void> {
    const membership = await this.companies.isMember(companyId, userId);
    if (!membership) throw new ForbiddenDomainError("Vous n'appartenez pas a cette entreprise.");
  }

  /**
   * Verification stricte utilisee avant toute application d'un tarif
   * professionnel (voir ADR-013) : l'utilisateur doit etre membre actif de
   * l'entreprise ET l'entreprise doit avoir ete approuvee. Retourne
   * l'appartenance (avec le role interne) pour permettre des controles de
   * permission plus fins par l'appelant.
   */
  async assertActiveApprovedMember(companyId: string, userId: string) {
    const company = await this.companies.findById(companyId);
    if (!company || company.status !== "APPROVED") {
      throw new ForbiddenDomainError("Cette entreprise n'est pas approuvee.");
    }
    const membership = await this.companies.isMember(companyId, userId);
    if (!membership) {
      throw new ForbiddenDomainError("Vous n'appartenez pas a cette entreprise.");
    }
    return membership;
  }
}
