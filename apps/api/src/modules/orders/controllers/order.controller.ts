import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { createOrderSchema, type CreateOrderRequest } from "@smc/contracts";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { OrderService } from "../services/order.service.js";
import { JwtAuthGuard, type RequestWithUser } from "../../identity/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";

@ApiTags("orders")
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post()
  @UsePipes(new ZodValidationPipe(createOrderSchema))
  create(@Body() body: CreateOrderRequest, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.orders.createOrder(body, user!.id);
  }

  @Get()
  listMine(@CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.orders.listOwnOrders(user!.id);
  }

  @Get(":id")
  getMine(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.orders.getOrderForUser(id, user!.id);
  }
}
