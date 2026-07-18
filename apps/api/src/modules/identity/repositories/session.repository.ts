import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { getPrismaClient, type Session } from "@smc/database";

export type RotationResult =
  | { outcome: "ROTATED"; session: Session }
  | { outcome: "REUSE_DETECTED" }
  | { outcome: "NOT_FOUND" };

/**
 * Gestion des sessions (refresh tokens). La rotation est atomique et
 * detecte la reutilisation d'un refresh token deja consomme (voir
 * ADR-014) : une famille de sessions (`familyId`) regroupe toutes les
 * rotations issues d'une meme connexion initiale, et est integralement
 * revoquee des qu'une reutilisation est detectee.
 */
@Injectable()
export class SessionRepository {
  private readonly prisma = getPrismaClient();

  create(data: {
    userId: string;
    familyId?: string;
    refreshTokenHash: string;
    expiresAt: Date;
    userAgent?: string;
    ipAddress?: string;
  }): Promise<Session> {
    return this.prisma.session.create({ data: { ...data, familyId: data.familyId ?? randomUUID() } });
  }

  findActiveByHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: { refreshTokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
  }

  findAnyByHash(refreshTokenHash: string): Promise<Session | null> {
    return this.prisma.session.findFirst({ where: { refreshTokenHash } });
  }

  /**
   * Rotation atomique : la session presentee n'est revoquee que si elle
   * est encore active au moment de l'ecriture (`updateMany` conditionnel).
   * Si la revocation echoue (count === 0), la session avait deja ete
   * revoquee par une rotation concurrente ou par une reutilisation
   * malveillante : le second cas est traite par l'appelant
   * (AuthService.refresh) via `findAnyByHash` + `revokeFamily`.
   */
  async rotateIfActive(
    sessionId: string,
    newHash: string,
    newExpiresAt: Date,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<RotationResult> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.session.findUnique({ where: { id: sessionId } });
      if (!current) return { outcome: "NOT_FOUND" };

      const revocation = await tx.session.updateMany({
        where: { id: sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: "ROTATED" },
      });
      if (revocation.count === 0) {
        // Deja revoquee : rotation concurrente ou reutilisation.
        return { outcome: "REUSE_DETECTED" };
      }

      const created = await tx.session.create({
        data: {
          userId: current.userId,
          familyId: current.familyId,
          refreshTokenHash: newHash,
          expiresAt: newExpiresAt,
          userAgent: context.userAgent,
          ipAddress: context.ipAddress,
        },
      });
      await tx.session.update({ where: { id: sessionId }, data: { replacedBySessionId: created.id } });
      return { outcome: "ROTATED", session: created };
    });
  }

  async revokeFamily(familyId: string, reason: string): Promise<{ count: number }> {
    return this.prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  revoke(sessionId: string, reason = "LOGOUT"): Promise<Session> {
    return this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date(), revokedReason: reason } });
  }

  revokeAllForUser(userId: string, exceptSessionId?: string, reason = "USER_REVOKED_ALL"): Promise<{ count: number }> {
    return this.prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  touchLastUsed(sessionId: string): Promise<Session> {
    return this.prisma.session.update({ where: { id: sessionId }, data: { lastUsedAt: new Date() } });
  }

  listActiveForUser(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: "desc" },
    });
  }
}
