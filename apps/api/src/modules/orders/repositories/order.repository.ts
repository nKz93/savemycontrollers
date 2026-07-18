import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma } from "@smc/database";

@Injectable()
export class OrderRepository {
  private readonly prisma = getPrismaClient();

  createInTransaction(tx: Prisma.TransactionClient, data: Prisma.OrderCreateInput) {
    return tx.order.create({ data, include: { items: true } });
  }

  findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { serviceSnapshots: true, optionSnapshots: true } }, repairCases: true },
    });
  }

  listForUser(userId: string) {
    return this.prisma.order.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  }

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
