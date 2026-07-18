import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class RepairHistoryRepository {
  private readonly prisma = getPrismaClient();

  append(data: { repairCaseId: string; statusKey: string; changedByUserId?: string; comment?: string }) {
    return this.prisma.repairStatusHistory.create({ data });
  }

  listForCase(repairCaseId: string) {
    return this.prisma.repairStatusHistory.findMany({
      where: { repairCaseId },
      orderBy: { changedAt: "desc" },
    });
  }
}
