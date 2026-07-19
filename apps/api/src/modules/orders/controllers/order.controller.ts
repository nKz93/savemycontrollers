import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from "@nestjs/common";
import { ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";
import { createOrderSchema, type CreateOrderRequest } from "@smc/contracts";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { OrderService } from "../services/order.service.js";
import { JwtAuthGuard, type RequestWithUser } from "../../identity/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { CreateOrderBodyDto, OrderDetailResponseDto, OrderSummaryResponseDto } from "../swagger/order.swagger-dto.js";

@ApiTags("orders")
@Controller("orders")
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orders: OrderService) {}

  @Post()
  @ApiBody({ type: CreateOrderBodyDto })
  @ApiResponse({ status: 201, type: OrderDetailResponseDto })
  @ApiResponse({ status: 400, description: "Panier vide, deja converti, expire, ou ligne invalide." })
  @ApiResponse({ status: 403, description: "Panier ou adresse n'appartenant pas a l'utilisateur courant." })
  @UsePipes(new ZodValidationPipe(createOrderSchema))
  create(@Body() body: CreateOrderRequest, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.orders.createOrder(body, user!.id);
  }

  @Get()
  @ApiResponse({ status: 200, type: [OrderSummaryResponseDto] })
  listMine(@CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.orders.listOwnOrders(user!.id);
  }

  @Get(":id")
  @ApiResponse({ status: 200, type: OrderDetailResponseDto })
  @ApiResponse({ status: 404, description: "Commande introuvable ou n'appartenant pas a l'utilisateur courant." })
  getMine(@Param("id") id: string, @CurrentUser() user: RequestWithUser["currentUser"]) {
    return this.orders.getOrderForUser(id, user!.id);
  }
}
