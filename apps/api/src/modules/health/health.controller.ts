import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

/**
 * Le healthcheck PUBLIC ne doit jamais reveler de details d'infrastructure
 * (etat detaille de PostgreSQL/Redis/stockage) — voir section 9 du prompt.
 * Le detail complet est expose par un endpoint interne protege
 * (health-internal.controller.ts).
 */
@ApiTags("health")
@Controller("health")
export class HealthController {
  @Get()
  check() {
    return {
      status: "ok",
      version: process.env.npm_package_version ?? "0.1.0",
    };
  }
}
