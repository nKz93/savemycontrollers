import { Injectable } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { ForbiddenDomainError } from "../../core/errors/domain-error.js";

export type AccountTypeClaim = "INDIVIDUAL" | "COMPANY_MEMBER" | "STAFF";

export interface AccessTokenClaims {
  sub: string; // userId
  accountType: AccountTypeClaim;
  jti: string;
}

const JWT_ALGORITHM = "HS256" as const;
const VALID_ACCOUNT_TYPES: readonly AccountTypeClaim[] = ["INDIVIDUAL", "COMPANY_MEMBER", "STAFF"];

/**
 * Access token : JWT signe (HMAC-SHA256 explicitement impose, jamais
 * "none" ni un autre algorithme), courte duree de vie, jamais persiste.
 * Issuer/audience/iat/exp/jti systematiquement presents et verifies (voir
 * ADR-018). Refresh token : chaine aleatoire opaque, seul son hash SHA-256
 * est stocke en base. En cas de fuite de la base, le refresh token brut
 * reste non reconstituable.
 */
@Injectable()
export class TokenService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS ?? 900);
  private readonly refreshTokenTtlSeconds = Number(process.env.REFRESH_TOKEN_TTL_SECONDS ?? 2592000);
  private readonly issuer = process.env.JWT_ISSUER ?? "savemycontrollers";
  private readonly audience = process.env.JWT_AUDIENCE ?? "savemycontrollers-api";

  constructor() {
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      // Aucun secret de secours utilisable : voir ADR-018 et
      // config/env.schema.ts (validateEnv refuse deja le demarrage en
      // production si ce cas se presente ; cette garde protege aussi les
      // environnements ou validateEnv n'aurait pas ete appele, par exemple
      // un test unitaire instanciant directement ce service).
      throw new Error("ACCESS_TOKEN_SECRET est obligatoire : aucune valeur de secours n'est autorisee.");
    }
    this.accessTokenSecret = secret;
  }

  signAccessToken(claims: { sub: string; accountType: AccountTypeClaim }): string {
    return jwt.sign(
      { sub: claims.sub, accountType: claims.accountType },
      this.accessTokenSecret,
      {
        algorithm: JWT_ALGORITHM,
        expiresIn: this.accessTokenTtlSeconds,
        issuer: this.issuer,
        audience: this.audience,
        jwtid: randomUUID(),
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    const decoded = jwt.verify(token, this.accessTokenSecret, {
      algorithms: [JWT_ALGORITHM], // rejette explicitement tout autre algorithme (dont "none")
      issuer: this.issuer,
      audience: this.audience,
    });
    if (typeof decoded === "string") {
      throw new ForbiddenDomainError("Jeton invalide.");
    }
    const { sub, accountType, jti } = decoded;
    if (typeof sub !== "string" || !sub) {
      throw new ForbiddenDomainError("Jeton incomplet (sujet manquant).");
    }
    if (typeof accountType !== "string" || !VALID_ACCOUNT_TYPES.includes(accountType as AccountTypeClaim)) {
      throw new ForbiddenDomainError("Jeton invalide (type de compte inconnu).");
    }
    if (typeof jti !== "string" || !jti) {
      throw new ForbiddenDomainError("Jeton incomplet (identifiant manquant).");
    }
    return { sub, accountType: accountType as AccountTypeClaim, jti };
  }

  get accessTokenTtlMs(): number {
    return this.accessTokenTtlSeconds * 1000;
  }

  get refreshTokenTtlMs(): number {
    return this.refreshTokenTtlSeconds * 1000;
  }

  generateOpaqueToken(): string {
    return randomBytes(48).toString("base64url");
  }

  hashOpaqueToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
