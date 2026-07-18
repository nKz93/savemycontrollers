import type { Redis } from "ioredis";

/**
 * Limitation de debit distribuee (coherente entre plusieurs instances de
 * l'API), combinant plusieurs dimensions (route, IP, email normalise,
 * utilisateur) via une cle composite. Utilise un compteur Redis
 * atomique (INCR + EXPIRE conditionnel via script Lua) : deux requetes
 * concurrentes sur la meme cle ne peuvent jamais toutes les deux "gagner"
 * au-dela de la limite.
 */
const INCR_WITH_TTL_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if tonumber(current) == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
return current
`;

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  windowSeconds: number;
}

export class RedisRateLimiter {
  constructor(private readonly redis: Redis) {}

  /**
   * `dimensions` est une liste ordonnee de valeurs (ex. [route, ip,
   * emailNormalise]) combinees en une seule cle Redis. Le sel `scope`
   * evite toute collision entre limiteurs utilises a des fins
   * differentes.
   */
  async checkAndIncrement(scope: string, dimensions: string[], limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const key = `ratelimit:${scope}:${dimensions.map((d) => d.toLowerCase().trim()).join(":")}`;
    const current = (await this.redis.eval(INCR_WITH_TTL_SCRIPT, 1, key, String(windowSeconds))) as number;
    return { allowed: current <= limit, current, limit, windowSeconds };
  }

  /** Reinitialise une cle (utile pour les tests ou une action administrative). */
  async reset(scope: string, dimensions: string[]): Promise<void> {
    const key = `ratelimit:${scope}:${dimensions.map((d) => d.toLowerCase().trim()).join(":")}`;
    await this.redis.del(key);
  }
}

/** Normalisation d'email pour la limitation (insensible a la casse, espaces retires). */
export function normalizeEmailForRateLimit(email: string): string {
  return email.trim().toLowerCase();
}
