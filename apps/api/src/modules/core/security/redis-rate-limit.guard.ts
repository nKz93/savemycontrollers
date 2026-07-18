import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { ThrottlerException } from "@nestjs/throttler";
import { Reflector } from "@nestjs/core";
import IORedis from "ioredis";
import { RedisRateLimiter, normalizeEmailForRateLimit } from "@smc/queue";
import type { Request } from "express";

export const RATE_LIMIT_KEY = "redis_rate_limit";

export interface RateLimitOptions {
  limit: number;
  windowSeconds: number;
  /** Si true, inclut l'email normalise du corps de la requete (champ `email`) dans la cle composite. */
  byEmail?: boolean;
}

/**
 * Decorateur applique sur une route sensible pour activer la limitation
 * de debit distribuee Redis (voir section 10/11 du prompt), en complement
 * (pas en remplacement) du `ThrottlerGuard` global en memoire.
 */
export const RedisRateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

let sharedRedis: IORedis | undefined;
function getRedisClient(): IORedis {
  if (!sharedRedis) {
    sharedRedis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: 2 });
  }
  return sharedRedis;
}

/**
 * Combine route + IP + (email normalise, si demande) + fenetre
 * temporelle. La reponse en cas de depassement reste generique (429),
 * sans jamais reveler si l'email existe (voir section 11 du prompt).
 */
@Injectable()
export class RedisRateLimitGuard implements CanActivate {
  private readonly limiter = new RedisRateLimiter(getRedisClient());

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!options) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const route = `${request.method}:${request.route?.path ?? request.path}`;
    const ip = request.ip ?? "unknown";
    const dimensions = [route, ip];

    if (options.byEmail) {
      const email = (request.body as { email?: string } | undefined)?.email;
      if (email) dimensions.push(normalizeEmailForRateLimit(email));
    }

    const result = await this.limiter.checkAndIncrement("http", dimensions, options.limit, options.windowSeconds);
    if (!result.allowed) {
      throw new ThrottlerException("Trop de tentatives. Reessayez plus tard.");
    }
    return true;
  }
}
