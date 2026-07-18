import { Injectable } from "@nestjs/common";
import { getPrismaClient } from "@smc/database";

/**
 * Consommation atomique des jetons a usage unique : la lecture, la
 * verification (non consomme, non expire) et l'ecriture sont fusionnees en
 * une seule instruction SQL conditionnelle (`updateMany` avec une clause
 * WHERE couvrant `consumedAt IS NULL AND expiresAt > NOW()`), ce qui
 * garantit qu'un seul appel concurrent peut reussir a consommer un jeton
 * donne (voir ADR-020 et le test associe).
 */
@Injectable()
export class VerificationTokenRepository {
  private readonly prisma = getPrismaClient();

  createEmailVerification(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  async consumeEmailVerification(tokenHash: string): Promise<{ userId: string } | null> {
    const result = await this.prisma.emailVerificationToken.updateMany({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (result.count !== 1) return null;
    const token = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    return token ? { userId: token.userId } : null;
  }

  async createPasswordReset(userId: string, tokenHash: string, expiresAt: Date) {
    // Invalide les jetons de reinitialisation encore actifs du meme
    // utilisateur : un seul jeton de reinitialisation valide a la fois.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    return this.prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  async consumePasswordReset(tokenHash: string): Promise<{ userId: string } | null> {
    const result = await this.prisma.passwordResetToken.updateMany({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (result.count !== 1) return null;
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    return token ? { userId: token.userId } : null;
  }
}
