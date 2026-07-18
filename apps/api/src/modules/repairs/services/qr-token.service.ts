import { Injectable } from "@nestjs/common";
import { randomBytes, createHash } from "node:crypto";

/**
 * Jeton QR opaque : aleatoire, non predictible, sans donnee personnelle ni
 * identifiant sequentiel. Seul son hash SHA-256 est stocke en base
 * (RepairCase.qrTokenHash). Voir ADR-009-qr-codes-opaques.md
 */
@Injectable()
export class QrTokenService {
  generate(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString("base64url");
    return { rawToken, tokenHash: createHash("sha256").update(rawToken).digest("hex") };
  }

  hash(rawToken: string): string {
    return createHash("sha256").update(rawToken).digest("hex");
  }
}
