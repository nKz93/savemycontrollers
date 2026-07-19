import { z } from "zod";

/**
 * Schema de validation centralise de l'environnement. Valide au demarrage
 * (voir main.ts) — l'application refuse de demarrer si une variable
 * critique manque ou est manifestement dangereuse en production (voir
 * ADR-018).
 */
const INSECURE_DEV_SECRET = "dev-only-insecure-secret-change-me";
const INSECURE_DEV_CSRF_SECRET = "dev-only-insecure-csrf-secret-change-me";
const KNOWN_DEV_MINIO_KEYS = ["smc_minio_access_key", "smc_minio_secret_key"];

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "preprod", "production"]).default("development"),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  // Limite globale du ThrottlerGuard (requetes/60s, par IP), en
  // complement du RedisRateLimitGuard cible par route. Configurable pour
  // permettre un seuil plus genereux dans l'environnement de validation
  // E2E (une suite de tests automatisee genere legitimement bien plus de
  // requetes par seconde qu'un utilisateur reel depuis une seule IP) sans
  // jamais affaiblir la valeur par defaut en production.
  THROTTLE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  API_URL: z.string().url(),
  COOKIE_DOMAIN: z.string().optional(),
  CORS_ALLOWED_ORIGINS: z.string().min(1),

  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  REDIS_URL: z.string().min(1),

  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_REGION: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_FROM: z.string().min(1),

  ACCESS_TOKEN_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).default(2592000),
  JWT_ISSUER: z.string().min(1).default("savemycontrollers"),
  JWT_AUDIENCE: z.string().min(1).default("savemycontrollers-api"),
  CSRF_SECRET: z.string().min(1),

  ARGON2_MEMORY_COST: z.coerce.number().int().min(8192).default(19456),
  ARGON2_TIME_COST: z.coerce.number().int().min(1).default(2),
  ARGON2_PARALLELISM: z.coerce.number().int().min(1).default(1),

  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(2000),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(20),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(5),
  OUTBOX_STALE_LOCK_MS: z.coerce.number().int().min(1000).default(300000),

  SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().min(12).optional(),

  PAYLOAD_ENCRYPTION_KEY: z.string().optional(), // base64, 32 octets — requis en production (voir refine ci-dessous)

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  SENTRY_DSN: z.string().optional(),

  TRUSTED_PROXY_COUNT: z.coerce.number().int().min(0).default(0),
});

export type AppEnv = z.infer<typeof baseSchema>;

function containsLocalOrExampleDomain(value: string): boolean {
  return /(^|[./])(localhost|.*\.example)([:/]|$)/i.test(value);
}

/**
 * Valide `process.env` et applique les regles renforcees de production.
 * Leve une erreur explicite (et fait donc echouer le demarrage) si une
 * variable critique manque ou si une valeur de developpement est detectee
 * en production.
 */
export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = baseSchema.safeParse(rawEnv);
  if (!parsed.success) {
    throw new Error(
      `Configuration d'environnement invalide :\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n")}`,
    );
  }
  const env = parsed.data;

  if (env.NODE_ENV === "production") {
    const errors: string[] = [];

    if (env.ACCESS_TOKEN_SECRET === INSECURE_DEV_SECRET) {
      errors.push("ACCESS_TOKEN_SECRET utilise la valeur de secours de developpement — interdit en production.");
    }
    if (env.ACCESS_TOKEN_SECRET.length < 32) {
      errors.push("ACCESS_TOKEN_SECRET doit contenir au moins 32 caracteres en production.");
    }
    if (env.CSRF_SECRET === INSECURE_DEV_CSRF_SECRET) {
      errors.push("CSRF_SECRET utilise la valeur de secours de developpement — interdit en production.");
    }
    if (env.CSRF_SECRET.length < 32) {
      errors.push("CSRF_SECRET doit contenir au moins 32 caracteres en production.");
    }
    if (KNOWN_DEV_MINIO_KEYS.includes(env.STORAGE_ACCESS_KEY_ID) || KNOWN_DEV_MINIO_KEYS.includes(env.STORAGE_SECRET_ACCESS_KEY)) {
      errors.push("Des identifiants MinIO de developpement sont utilises — interdit en production.");
    }
    for (const [key, value] of [
      ["API_URL", env.API_URL],
      ["STORAGE_ENDPOINT", env.STORAGE_ENDPOINT],
      ["COOKIE_DOMAIN", env.COOKIE_DOMAIN ?? ""],
      ["SMTP_FROM", env.SMTP_FROM],
    ] as const) {
      if (value && containsLocalOrExampleDomain(value)) {
        errors.push(`${key} contient un domaine de developpement (localhost/.example) — interdit en production.`);
      }
    }
    if (env.SEED_SUPERADMIN_EMAIL || env.SEED_SUPERADMIN_PASSWORD) {
      errors.push("SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD ne doivent jamais etre definis en production.");
    }
    if (!env.PAYLOAD_ENCRYPTION_KEY) {
      errors.push("PAYLOAD_ENCRYPTION_KEY est requis en production (chiffrement des charges utiles sensibles de l'Outbox, voir ADR-016).");
    }
    if (env.COOKIE_DOMAIN === "localhost") {
      errors.push('COOKIE_DOMAIN ne doit jamais valoir "localhost" (y compris hors production, cela empeche les cookies de fonctionner correctement) — laisser vide en local.');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration de production refusee :\n${errors.map((e) => `  - ${e}`).join("\n")}`);
    }
  }

  return env;
}
