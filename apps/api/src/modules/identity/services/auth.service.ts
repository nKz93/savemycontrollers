import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ConflictDomainError, ForbiddenDomainError, ValidationDomainError } from "../../core/errors/domain-error.js";
import { BUSINESS_EVENT_TYPES } from "../../core/events/business-event.js";
import { OutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import { AuditService } from "../../audit/services/audit.service.js";
import { encryptSensitiveValue } from "../../core/security/payload-encryption.js";
import { UserRepository } from "../repositories/user.repository.js";
import { SessionRepository } from "../repositories/session.repository.js";
import { VerificationTokenRepository } from "../repositories/verification-token.repository.js";
import { PasswordService } from "./password.service.js";
import { TokenService, type AccountTypeClaim } from "./token.service.js";
import { getPrismaClient } from "@smc/database";

const FAILED_LOGIN_LOCK_THRESHOLD = 5;
const FAILED_LOGIN_LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
}

@Injectable()
export class AuthService {
  private readonly prisma = getPrismaClient();

  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly verificationTokens: VerificationTokenRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly outbox: OutboxRepository,
    private readonly audit: AuditService,
  ) {}

  async register(input: { email: string; password: string; firstName: string; lastName: string }, meta: RequestMetadata) {
    if (!this.passwords.isPasswordAcceptable(input.password)) {
      throw new ValidationDomainError("Le mot de passe ne respecte pas la politique de securite.");
    }
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      // Reponse volontairement generique cote controleur pour eviter
      // l'enumeration d'utilisateurs (voir section 20 de l'architecture).
      throw new ConflictDomainError("Impossible de creer ce compte.");
    }

    const passwordHash = await this.passwords.hash(input.password);
    const correlationId = meta.correlationId;

    const { user, verificationTokenRaw } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
        },
      });

      const rawToken = this.tokens.generateOpaqueToken();
      await tx.emailVerificationToken.create({
        data: {
          userId: created.id,
          tokenHash: this.tokens.hashOpaqueToken(rawToken),
          expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });

      await this.outbox.appendInTransaction(tx, {
        eventType: BUSINESS_EVENT_TYPES.USER_REGISTERED,
        aggregateType: "User",
        aggregateId: created.id,
        payload: { email: created.email, firstName: created.firstName },
        correlationId,
      });
      // Le jeton brut ne doit jamais transiter en clair dans l'Outbox
      // (table potentiellement presente dans des sauvegardes non
      // chiffrees) : il est chiffre applicativement (voir ADR-016). Seul
      // le worker, disposant de PAYLOAD_ENCRYPTION_KEY, peut le dechiffrer
      // au moment de l'envoi de l'email.
      await this.outbox.appendInTransaction(
        tx,
        {
          eventType: BUSINESS_EVENT_TYPES.EMAIL_VERIFICATION_REQUESTED,
          aggregateType: "User",
          aggregateId: created.id,
          payload: { email: created.email, encryptedToken: encryptSensitiveValue(rawToken) },
          correlationId,
        },
        { encrypted: true },
      );

      return { user: created, verificationTokenRaw: rawToken };
    });

    await this.audit.record(
      { actorUserId: user.id, actorType: "USER", correlationId, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
      { action: "user.registered", resourceType: "User", resourceId: user.id, result: "SUCCESS" },
    );

    // Le jeton brut n'est retourne ici que pour les besoins des tests
    // d'integration ; l'API HTTP publique (auth.controller.ts) ne doit
    // jamais l'exposer dans la reponse.
    return { userId: user.id, verificationTokenRaw };
  }

  async verifyEmail(rawToken: string) {
    const consumed = await this.verificationTokens.consumeEmailVerification(this.tokens.hashOpaqueToken(rawToken));
    if (!consumed) {
      throw new ValidationDomainError("Jeton de verification invalide ou expire.");
    }
    return this.users.markEmailVerified(consumed.userId);
  }

  async login(input: { email: string; password: string }, meta: RequestMetadata) {
    const user = await this.users.findByEmail(input.email);
    // Meme message d'erreur que l'utilisateur existe ou non (anti-enumeration).
    const genericError = () => new ValidationDomainError("Identifiants invalides.");

    if (!user) throw genericError();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenDomainError("Compte temporairement verrouille suite a plusieurs echecs de connexion.");
    }

    const validPassword = await this.passwords.verify(user.passwordHash, input.password);
    if (!validPassword) {
      await this.users.registerFailedLogin(user.id, FAILED_LOGIN_LOCK_THRESHOLD, FAILED_LOGIN_LOCK_DURATION_MS);
      await this.audit.record(
        { actorUserId: user.id, actorType: "USER", correlationId: meta.correlationId, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
        { action: "user.login_failed", resourceType: "User", resourceId: user.id, result: "FAILURE" },
      );
      throw genericError();
    }

    await this.users.resetFailedLogins(user.id);

    const rawRefreshToken = this.tokens.generateOpaqueToken();
    const session = await this.sessions.create({
      userId: user.id,
      refreshTokenHash: this.tokens.hashOpaqueToken(rawRefreshToken),
      expiresAt: new Date(Date.now() + this.tokens.refreshTokenTtlMs),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    });

    const accessToken = this.tokens.signAccessToken({ sub: user.id, accountType: user.accountType as AccountTypeClaim });

    await this.audit.record(
      { actorUserId: user.id, actorType: "USER", correlationId: meta.correlationId, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
      { action: "user.login_succeeded", resourceType: "User", resourceId: user.id, result: "SUCCESS" },
    );

    return { user, accessToken, rawRefreshToken, sessionId: session.id };
  }

  /**
   * Rotation atomique avec detection de reutilisation (voir ADR-014). Si
   * le refresh token presente correspond a une session deja revoquee
   * (typiquement : un jeton vole rejoue apres que le legitime proprietaire
   * a deja tourne), toute la famille de sessions est revoquee et l'appel
   * echoue — l'attaquant ET l'utilisateur legitime doivent se reconnecter,
   * ce qui est le comportement de securite attendu (voir tests associes).
   */
  async refresh(rawRefreshToken: string, meta: { userAgent?: string; ipAddress?: string; correlationId: string }) {
    const hash = this.tokens.hashOpaqueToken(rawRefreshToken);
    const existing = await this.sessions.findAnyByHash(hash);
    if (!existing) {
      throw new ForbiddenDomainError("Session invalide ou expiree.");
    }
    if (existing.expiresAt < new Date()) {
      throw new ForbiddenDomainError("Session expiree.");
    }

    const newRawRefreshToken = this.tokens.generateOpaqueToken();
    const result = await this.sessions.rotateIfActive(
      existing.id,
      this.tokens.hashOpaqueToken(newRawRefreshToken),
      new Date(Date.now() + this.tokens.refreshTokenTtlMs),
      { userAgent: meta.userAgent, ipAddress: meta.ipAddress },
    );

    if (result.outcome === "REUSE_DETECTED") {
      await this.sessions.revokeFamily(existing.familyId, "REUSE_DETECTED");
      await this.audit.record(
        { actorUserId: existing.userId, actorType: "USER", correlationId: meta.correlationId, ipAddress: meta.ipAddress, userAgent: meta.userAgent },
        { action: "user.refresh_token_reuse_detected", resourceType: "User", resourceId: existing.userId, result: "FAILURE" },
      );
      throw new ForbiddenDomainError("Reutilisation d'un jeton de rafraichissement detectee : toutes les sessions ont ete revoquees.");
    }
    if (result.outcome === "NOT_FOUND") {
      throw new ForbiddenDomainError("Session invalide ou expiree.");
    }

    const user = await this.users.findById(result.session.userId);
    if (!user || !user.isActive) {
      throw new ForbiddenDomainError("Compte indisponible.");
    }

    const accessToken = this.tokens.signAccessToken({ sub: user.id, accountType: user.accountType as AccountTypeClaim });
    return { accessToken, rawRefreshToken: newRawRefreshToken, sessionId: result.session.id };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const hash = this.tokens.hashOpaqueToken(rawRefreshToken);
    const session = await this.sessions.findActiveByHash(hash);
    if (session) await this.sessions.revoke(session.id, "LOGOUT");
  }

  async listSessions(userId: string, currentSessionHash?: string) {
    const sessions = await this.sessions.listActiveForUser(userId);
    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      current: s.refreshTokenHash === currentSessionHash,
    }));
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId, currentSessionId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (!user) return; // ne jamais reveler si l'email existe
    const rawToken = this.tokens.generateOpaqueToken();
    await this.verificationTokens.createPasswordReset(
      user.id,
      this.tokens.hashOpaqueToken(rawToken),
      new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    );
    // L'envoi effectif de l'email est realise par le worker via un
    // evenement metier chiffre (meme strategie que la verification email,
    // point d'integration pret, non code en dur ici).
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    if (!this.passwords.isPasswordAcceptable(newPassword)) {
      throw new ValidationDomainError("Le mot de passe ne respecte pas la politique de securite.");
    }
    const consumed = await this.verificationTokens.consumePasswordReset(this.tokens.hashOpaqueToken(rawToken));
    if (!consumed) {
      throw new ValidationDomainError("Jeton de reinitialisation invalide ou expire.");
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.users.updatePasswordHash(consumed.userId, passwordHash);
    await this.sessions.revokeAllForUser(consumed.userId, undefined, "PASSWORD_RESET");
  }

  correlationId(): string {
    return randomUUID();
  }
}
