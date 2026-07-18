import { Module } from "@nestjs/common";
import { AuditRepository } from "./repositories/audit.repository.js";
import { AuditService } from "./services/audit.service.js";

@Module({
  providers: [AuditRepository, AuditService],
  exports: [AuditService],
})
export class AuditModule {}
