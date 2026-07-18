import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { getPrismaClient } from "@smc/database";
import IORedis from "ioredis";
import { JwtAuthGuard } from "../identity/guards/jwt-auth.guard.js";
import { PermissionGuard } from "../authorization/guards/permission.guard.js";
import { RequirePermission } from "../authorization/decorators/require-permission.decorator.js";
import { PERMISSIONS } from "../authorization/constants/permissions.js";

/**
 * Etat detaille (PostgreSQL, Redis) reserve au personnel autorise
 * (permission `settings.manage`, reutilisee ici comme permission
 * d'administration technique generale).
 */
@ApiTags("health-internal")
@Controller("internal/health")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class HealthInternalController {
  @Get()
  @RequirePermission(PERMISSIONS.SETTINGS_MANAGE)
  async check() {
    const [postgres, redis] = await Promise.allSettled([this.checkPostgres(), this.checkRedis()]);
    return {
      status: postgres.status === "fulfilled" && redis.status === "fulfilled" ? "ok" : "degraded",
      version: process.env.npm_package_version ?? "0.1.0",
      checks: {
        postgres: postgres.status === "fulfilled" ? "ok" : "unreachable",
        redis: redis.status === "fulfilled" ? "ok" : "unreachable",
      },
    };
  }

  private async checkPostgres(): Promise<void> {
    await getPrismaClient().$queryRaw`SELECT 1`;
  }

  private async checkRedis(): Promise<void> {
    const client = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      lazyConnect: true,
    });
    try {
      await client.connect();
      await client.ping();
    } finally {
      client.disconnect();
    }
  }
}
