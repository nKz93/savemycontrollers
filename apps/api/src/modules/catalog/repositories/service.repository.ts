import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class ServiceRepository {
  private readonly prisma = getPrismaClient();

  listActive() {
    return this.prisma.service.findMany({
      where: { status: "ACTIVE" },
      include: { options: { where: { status: "ACTIVE" } }, category: true },
      orderBy: { displayOrder: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.service.findUnique({ where: { id }, include: { options: true } });
  }

  findManyByIds(ids: string[]) {
    return this.prisma.service.findMany({ where: { id: { in: ids } } });
  }

  findOptionsByIds(ids: string[]) {
    return this.prisma.serviceOption.findMany({ where: { id: { in: ids } } });
  }

  findRequiredOptionsForServices(serviceIds: string[]) {
    return this.prisma.serviceOption.findMany({
      where: { serviceId: { in: serviceIds }, isRequired: true, status: "ACTIVE" },
    });
  }
}
