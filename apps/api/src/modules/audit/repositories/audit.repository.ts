import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma } from "@smc/database";

@Injectable()
export class AuditRepository {
  private readonly prisma = getPrismaClient();

  append(entry: {
    actorUserId?: string | null;
    actorType: "USER" | "STAFF" | "SYSTEM";
    action: string;
    resourceType: string;
    resourceId?: string | null;
    result: "SUCCESS" | "FAILURE";
    ipAddress?: string | null;
    userAgent?: string | null;
    correlationId: string;
    beforeData?: Record<string, unknown>;
    afterData?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        ...entry,
        // Les appelants passent des objets litteraux JSON-serialisables
        // (voir AuditService.record) ; le cast est sur au niveau des
        // types puisque Prisma.InputJsonValue exige une structure JSON
        // stricte que `Record<string, unknown>` n'exprime pas
        // structurellement, mais que ces objets respectent en pratique.
        beforeData: entry.beforeData as Prisma.InputJsonValue | undefined,
        afterData: entry.afterData as Prisma.InputJsonValue | undefined,
      },
    });
  }

  listByResource(resourceType: string, resourceId: string) {
    return this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { occurredAt: "desc" },
    });
  }
}
