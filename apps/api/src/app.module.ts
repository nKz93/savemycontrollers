import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";

import { CoreModule } from "./modules/core/core.module.js";
import { AuditModule } from "./modules/audit/audit.module.js";
import { OutboxModule } from "./modules/outbox/outbox.module.js";
import { IdentityModule } from "./modules/identity/identity.module.js";
import { AuthorizationModule } from "./modules/authorization/authorization.module.js";
import { OrganizationsModule } from "./modules/organizations/organizations.module.js";
import { SettingsModule } from "./modules/settings/settings.module.js";
import { FilesModule } from "./modules/files/files.module.js";
import { CatalogModule } from "./modules/catalog/catalog.module.js";
import { ConfiguratorModule } from "./modules/configurator/configurator.module.js";
import { OrdersModule } from "./modules/orders/orders.module.js";
import { RepairsModule } from "./modules/repairs/repairs.module.js";
import { HealthModule } from "./modules/health/health.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    CoreModule,
    AuditModule,
    OutboxModule,
    IdentityModule,
    AuthorizationModule,
    OrganizationsModule,
    SettingsModule,
    FilesModule,
    CatalogModule,
    ConfiguratorModule,
    OrdersModule,
    RepairsModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
