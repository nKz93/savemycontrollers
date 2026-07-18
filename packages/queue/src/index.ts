import { Queue, Worker, type ConnectionOptions, type Job, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

/**
 * Point d'acces unique a Redis/BullMQ pour l'API et le worker.
 * Les noms de files sont centralises ici pour eviter toute divergence
 * entre le producteur (API, via Outbox) et le consommateur (worker).
 */
export const QUEUE_NAMES = {
  OUTBOX_EVENTS: "outbox-events",
  PDF_GENERATION: "pdf-generation",
  EMAIL_DELIVERY: "email-delivery",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function createRedisConnection(url: string): ConnectionOptions {
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function createQueue<TPayload>(name: QueueName, connection: ConnectionOptions) {
  return new Queue<TPayload>(name, { connection });
}

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 2000 },
  removeOnComplete: { age: 86400, count: 1000 },
  removeOnFail: { age: 7 * 86400 },
};

export { Worker, Job };
export { DEFAULT_JOB_OPTIONS };
export { RedisRateLimiter, normalizeEmailForRateLimit, type RateLimitResult } from "./rate-limiter.js";
