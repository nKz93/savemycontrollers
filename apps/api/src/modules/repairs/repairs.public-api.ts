import { Injectable } from "@nestjs/common";
import type { Prisma } from "@smc/database";
import { RepairCaseService } from "./services/repair-case.service.js";

/**
 * Interface publique consommee par le module Orders pour creer les
 * dossiers de reparation dans la meme transaction que la commande.
 */
@Injectable()
export class RepairsPublicApi {
  constructor(private readonly repairCaseService: RepairCaseService) {}

  createCasesForOrderInTransaction(
    tx: Prisma.TransactionClient,
    items: Array<{
      orderId: string;
      orderItemId: string;
      clientId?: string;
      companyId?: string;
      deviceModelId: string;
      deviceVariantId: string;
      hardwareRevisionId?: string;
      reportedIssue?: string;
    }>,
    correlationId: string,
  ) {
    return this.repairCaseService.createCasesForOrderInTransaction(tx, items, correlationId);
  }
}
