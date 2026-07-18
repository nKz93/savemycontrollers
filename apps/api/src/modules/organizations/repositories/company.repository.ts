import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

@Injectable()
export class CompanyRepository {
  private readonly prisma = getPrismaClient();

  create(data: { name: string; siret?: string; vatNumber?: string; ownerUserId: string }) {
    return this.prisma.company.create({
      data: {
        name: data.name,
        siret: data.siret,
        vatNumber: data.vatNumber,
        members: { create: { userId: data.ownerUserId, internalRole: "OWNER" } },
      },
    });
  }

  findById(id: string) {
    return this.prisma.company.findUnique({ where: { id }, include: { members: true } });
  }

  approve(id: string) {
    return this.prisma.company.update({ where: { id }, data: { status: "APPROVED" } });
  }

  reject(id: string) {
    return this.prisma.company.update({ where: { id }, data: { status: "REJECTED" } });
  }

  isMember(companyId: string, userId: string) {
    return this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
  }
}
