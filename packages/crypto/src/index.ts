import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Chiffrement applicatif (AES-256-GCM) partage entre l'API et le worker,
 * utilise pour les charges utiles sensibles transitant par l'Outbox (voir
 * ADR-016). `PAYLOAD_ENCRYPTION_KEY` est une cle base64 de 32 octets,
 * obligatoire en production.
 */
let cachedKey: Buffer | undefined;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const configured = process.env.PAYLOAD_ENCRYPTION_KEY;
  if (configured) {
    cachedKey = Buffer.from(configured, "base64");
    if (cachedKey.length !== 32) {
      throw new Error("PAYLOAD_ENCRYPTION_KEY doit decoder en exactement 32 octets (AES-256).");
    }
    return cachedKey;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("PAYLOAD_ENCRYPTION_KEY est obligatoire en production.");
  }
   
  console.warn("[securite] PAYLOAD_ENCRYPTION_KEY absent : cle ephemere generee pour cet environnement de developpement uniquement.");
  cachedKey = randomBytes(32);
  return cachedKey;
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  authTag: string; // base64
}

export function encryptSensitiveValue(plaintext: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSensitiveValue(payload: EncryptedPayload): string {
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
