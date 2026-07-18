import { Injectable } from "@nestjs/common";
import { getPrismaClient, type Prisma } from "@smc/database";

const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

@Injectable()
export class CartRepository {
  private readonly prisma = getPrismaClient();

  createForUser(userId: string, companyId?: string) {
    return this.prisma.cart.create({ data: { userId, companyId } });
  }

  createGuest(guestTokenHash: string) {
    return this.prisma.cart.create({
      data: { guestTokenHash, expiresAt: new Date(Date.now() + GUEST_CART_TTL_MS) },
    });
  }

  findById(id: string) {
    return this.prisma.cart.findUnique({
      where: { id },
      include: { items: { include: { services: true, options: true } } },
    });
  }

  findByGuestTokenHash(guestTokenHash: string) {
    return this.prisma.cart.findUnique({ where: { guestTokenHash } });
  }

  addItem(data: {
    cartId: string;
    deviceModelId: string;
    deviceVariantId: string;
    hardwareRevisionId?: string;
    reportedIssue?: string;
    serviceIds: string[];
    optionIds: string[];
  }) {
    return this.prisma.cartItem.create({
      data: {
        cartId: data.cartId,
        deviceModelId: data.deviceModelId,
        deviceVariantId: data.deviceVariantId,
        hardwareRevisionId: data.hardwareRevisionId,
        reportedIssue: data.reportedIssue,
        services: { create: data.serviceIds.map((serviceId) => ({ serviceId })) },
        options: { create: data.optionIds.map((serviceOptionId) => ({ serviceOptionId })) },
      },
    });
  }

  markConverted(cartId: string, orderId: string) {
    return this.prisma.cart.update({
      where: { id: cartId },
      data: { convertedToOrderId: orderId, convertedAt: new Date() },
    });
  }

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn);
  }
}
