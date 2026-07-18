import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma } from "@smc/database";

@Injectable()
export class RepairCaseRepository {
  private readonly prisma = getPrismaClient();

  createInTransaction(tx: Prisma.TransactionClient, data: Prisma.RepairCaseCreateInput) {
    return tx.repairCase.create({ data });
  }

  findById(id: string) {
    return this.prisma.repairCase.findUnique({
      where: { id },
      include: { history: { orderBy: { changedAt: "desc" } }, notes: true, status: true },
    });
  }

  findByReference(reference: string) {
    return this.prisma.repairCase.findUnique({ where: { reference } });
  }

  findByQrTokenHash(qrTokenHash: string) {
    return this.prisma.repairCase.findFirst({ where: { qrTokenHash, qrTokenRevokedAt: null } });
  }

  findByPublicTrackingTokenHash(tokenHash: string) {
    return this.prisma.repairCase.findFirst({ where: { publicTrackingTokenHash: tokenHash, publicTrackingTokenRevokedAt: null } });
  }

  listForClient(clientId: string) {
    return this.prisma.repairCase.findMany({
      where: { clientId },
      include: { status: true, deviceModel: true },
      orderBy: { createdAt: "desc" },
    });
  }

  listForStaff(filter: { statusKey?: string; assignedTechnicianId?: string }) {
    return this.prisma.repairCase.findMany({
      where: filter,
      include: { status: true, deviceModel: true },
      orderBy: { createdAt: "desc" },
    });
  }

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }

  /**
   * Mise a jour conditionnelle (verrouillage optimiste) executable au sein
   * d'une transaction fournie par l'appelant, pour que le controle du
   * verrou, la modification du statut, l'historique et l'evenement Outbox
   * soient atomiques (voir section 16 du prompt et ADR-021).
   */
  updateStatusWithOptimisticLockInTransaction(
    tx: Prisma.TransactionClient,
    id: string,
    expectedLockVersion: number,
    newStatusKey: string,
  ): Promise<{ count: number }> {
    return tx.repairCase.updateMany({
      where: { id, lockVersion: expectedLockVersion },
      data: { statusKey: newStatusKey, lockVersion: { increment: 1 } },
    });
  }

  appendHistoryInTransaction(
    tx: Prisma.TransactionClient,
    data: { repairCaseId: string; statusKey: string; changedByUserId?: string; comment?: string },
  ) {
    return tx.repairStatusHistory.create({ data });
  }

  assignTechnician(id: string, technicianId: string) {
    return this.prisma.repairCase.update({ where: { id }, data: { assignedTechnicianId: technicianId } });
  }

  setTechnicianDiagnosis(id: string, diagnosis: string) {
    return this.prisma.repairCase.update({ where: { id }, data: { technicianDiagnosis: diagnosis } });
  }

  regenerateQrToken(id: string, newTokenHash: string) {
    return this.prisma.repairCase.update({
      where: { id },
      data: { qrTokenHash: newTokenHash, qrTokenRevokedAt: null },
    });
  }

  revokeQrToken(id: string) {
    return this.prisma.repairCase.update({ where: { id }, data: { qrTokenRevokedAt: new Date() } });
  }

  setPublicTrackingToken(id: string, tokenHash: string | null) {
    return this.prisma.repairCase.update({
      where: { id },
      data: { publicTrackingTokenHash: tokenHash, publicTrackingTokenRevokedAt: tokenHash ? null : new Date() },
    });
  }
}
