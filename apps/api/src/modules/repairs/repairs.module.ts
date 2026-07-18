import { Module } from "@nestjs/common";
import { RepairCaseRepository } from "./repositories/repair-case.repository.js";
import { RepairStatusRepository } from "./repositories/repair-status.repository.js";
import { RepairHistoryRepository } from "./repositories/repair-history.repository.js";
import { RepairNoteRepository } from "./repositories/repair-note.repository.js";
import { QrTokenService } from "./services/qr-token.service.js";
import { RepairCaseService } from "./services/repair-case.service.js";
import { RepairCaseController } from "./controllers/repair-case.controller.js";
import { RepairsPublicApi } from "./repairs.public-api.js";
import { AuditModule } from "../audit/audit.module.js";
import { OutboxModule } from "../outbox/outbox.module.js";
import { AuthorizationModule } from "../authorization/authorization.module.js";
import { CoreModule } from "../core/core.module.js";
import { IdentityModule } from "../identity/identity.module.js";

@Module({
  imports: [AuditModule, OutboxModule, AuthorizationModule, CoreModule, IdentityModule],
  controllers: [RepairCaseController],
  providers: [
    RepairCaseRepository,
    RepairStatusRepository,
    RepairHistoryRepository,
    RepairNoteRepository,
    QrTokenService,
    RepairCaseService,
    RepairsPublicApi,
  ],
  exports: [RepairsPublicApi, RepairCaseService],
})
export class RepairsModule {}
