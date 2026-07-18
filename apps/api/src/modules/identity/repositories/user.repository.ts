import { Injectable } from "@nestjs/common";
import { getPrismaClient, type User } from "@smc/database";

/**
 * Seul point d'acces a la table `users`. Aucun autre module ne doit
 * importer PrismaClient pour lire/ecrire cette table (regle ESLint
 * no-restricted-imports + revue de code).
 */
@Injectable()
export class UserRepository {
  private readonly prisma = getPrismaClient();

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
    });
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
  }

  updatePasswordHash(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async registerFailedLogin(userId: string, lockThreshold: number, lockDurationMs: number): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const attempts = user.failedLoginAttempts + 1;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= lockThreshold ? new Date(Date.now() + lockDurationMs) : user.lockedUntil,
      },
    });
  }

  resetFailedLogins(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}
