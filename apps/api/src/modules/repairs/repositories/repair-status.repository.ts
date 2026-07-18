import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class RepairStatusRepository {
  private readonly prisma = getPrismaClient();

  listStatuses() {
    return this.prisma.repairStatusDefinition.findMany({ orderBy: { displayOrder: "asc" } });
  }

  findStatus(key: string) {
    return this.prisma.repairStatusDefinition.findUnique({ where: { key } });
  }

  isTransitionAllowed(fromKey: string, toKey: string) {
    return this.prisma.repairStatusTransition.findUnique({
      where: { fromStatusKey_toStatusKey: { fromStatusKey: fromKey, toStatusKey: toKey } },
    });
  }
}
