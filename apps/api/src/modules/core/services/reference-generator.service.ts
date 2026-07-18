import { Injectable } from "@nestjs/common";
import { getPrismaClient, nextReferenceSequence } from "@smc/database";

/**
 * Generation de references commerciales lisibles, garantie sans collision
 * par un compteur atomique en base (voir ADR-012). La logique SQL est
 * partagee avec le worker via `@smc/database` (voir ADR sur la
 * consolidation de la logique de persistance, section 3 de la phase 2C).
 */
@Injectable()
export class ReferenceGeneratorService {
  private readonly prisma = getPrismaClient();

  async generateOrderReference(): Promise<string> {
    const sequence = await nextReferenceSequence(this.prisma, "ORDER");
    return `SMC-ORD-${sequence.year}-${String(sequence.value).padStart(6, "0")}`;
  }

  async generateRepairCaseReference(): Promise<string> {
    const sequence = await nextReferenceSequence(this.prisma, "REPAIR");
    return `SMC-${sequence.year}-${String(sequence.value).padStart(6, "0")}`;
  }
}
