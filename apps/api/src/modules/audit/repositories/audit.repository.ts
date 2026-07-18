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
    beforeData?: Prisma.InputJsonValue;
    afterData?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({ data: entry });
  }

  listByResource(resourceType: string, resourceId: string) {
    return this.prisma.auditLog.findMany({
      where: { resourceType, resourceId },
      orderBy: { occurredAt: "desc" },
    });
  }
}
