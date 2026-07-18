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

  /**
   * Recherche ET verification de propriete dans la MEME requete (voir
   * section 5 du prompt) : jamais un findById suivi d'une comparaison de
   * userId separee, qui laisserait une fenetre de lecture non autorisee
   * et permettrait a un attaquant de distinguer "n'existe pas" de
   * "appartient a quelqu'un d'autre" via un timing ou un comportement
   * different.
   */
  findByIdForUser(id: string, userId: string) {
    return this.prisma.order.findFirst({
      where: { id, userId },
      include: { items: { include: { serviceSnapshots: true, optionSnapshots: true } }, repairCases: true },
    });
  }

  listForUser(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  }

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
