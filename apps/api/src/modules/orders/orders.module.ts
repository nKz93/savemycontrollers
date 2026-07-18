import { Module } from "@nestjs/common";
import { CartRepository } from "./repositories/cart.repository.js";
import { OrderRepository } from "./repositories/order.repository.js";
import { AddressRepository } from "./repositories/address.repository.js";
import { CartService } from "./services/cart.service.js";
import { OrderService } from "./services/order.service.js";
import { AddressService } from "./services/address.service.js";
import { CartController } from "./controllers/cart.controller.js";
import { OrderController } from "./controllers/order.controller.js";
import { AddressController } from "./controllers/address.controller.js";
import { ConfiguratorModule } from "../configurator/configurator.module.js";
import { CatalogModule } from "../catalog/catalog.module.js";
import { RepairsModule } from "../repairs/repairs.module.js";
import { OutboxModule } from "../outbox/outbox.module.js";
import { OrganizationsModule } from "../organizations/organizations.module.js";
import { IdentityModule } from "../identity/identity.module.js";
import { CoreModule } from "../core/core.module.js";

@Module({
  imports: [ConfiguratorModule, CatalogModule, RepairsModule, OutboxModule, OrganizationsModule, IdentityModule, CoreModule],
  controllers: [CartController, OrderController, AddressController],
  providers: [CartRepository, OrderRepository, AddressRepository, CartService, OrderService, AddressService],
  exports: [OrderService, CartService],
})
export class OrdersModule {}
