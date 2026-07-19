import { Body, Controller, Get, Param, Post, Req, Res, UseGuards, UsePipes } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";
import { addCartItemSchema, type AddCartItemRequest, type CartDto } from "@smc/contracts";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { CartService } from "../services/cart.service.js";
import { JwtAuthGuard, type RequestWithUser } from "../../identity/guards/jwt-auth.guard.js";
import { CurrentUser } from "../../identity/decorators/current-user.decorator.js";
import { MergeCartResponseDto, CartResponseDto, AddCartItemBodyDto, EnsureGuestCartResponseDto } from "../swagger/order.swagger-dto.js";

const GUEST_CART_COOKIE = "smc_guest_cart_token";

/**
 * Panier invite : identifie par un jeton opaque en cookie HttpOnly, jamais
 * par la seule connaissance de l'UUID du panier (voir section 10 du
 * prompt). Panier authentifie : l'appartenance est verifiee par
 * CartService a partir de l'utilisateur courant.
 */
@ApiTags("cart")
@Controller("cart")
export class CartController {
  constructor(private readonly cart: CartService) {}

  private guestCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/cart",
    };
  }

  /** Cree ou reutilise le panier invite courant, pose le cookie si necessaire. */
  @Post("guest")
  @ApiResponse({ status: 201, type: EnsureGuestCartResponseDto })
  async ensureGuestCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const existingToken = req.cookies?.[GUEST_CART_COOKIE] as string | undefined;
    const handle = await this.cart.resolveOrCreateGuestCart(existingToken);
    if (handle.newGuestTokenRaw) {
      res.cookie(GUEST_CART_COOKIE, handle.newGuestTokenRaw, this.guestCookieOptions());
    }
    return { cartId: handle.cartId };
  }

  @Post(":cartId/items")
  @ApiBody({ type: AddCartItemBodyDto })
  @ApiResponse({ status: 201, type: CartResponseDto })
  @UsePipes(new ZodValidationPipe(addCartItemSchema))
  addItemGuest(@Param("cartId") cartId: string, @Body() body: AddCartItemRequest, @Req() req: Request): Promise<CartDto> {
    const guestTokenRaw = req.cookies?.[GUEST_CART_COOKIE] as string | undefined;
    return this.cart.addItem(cartId, body, { guestTokenRaw });
  }

  @Post(":cartId/items/authenticated")
  @UseGuards(JwtAuthGuard)
  @ApiBody({ type: AddCartItemBodyDto })
  @ApiResponse({ status: 201, type: CartResponseDto })
  @UsePipes(new ZodValidationPipe(addCartItemSchema))
  addItemAuthenticated(
    @Param("cartId") cartId: string,
    @Body() body: AddCartItemRequest,
    @CurrentUser() user: RequestWithUser["currentUser"],
  ): Promise<CartDto> {
    return this.cart.addItem(cartId, body, { userId: user!.id });
  }

  /**
   * Fusion du panier invite dans le compte a la connexion. userId
   * provient exclusivement du JWT (JwtAuthGuard + @CurrentUser), le
   * jeton invite exclusivement du cookie HttpOnly — aucun des deux
   * n'est jamais accepte depuis le corps de la requete. Protegee par
   * CSRF comme toute route POST authentifiee (voir main.ts).
   */
  @Post("merge")
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 201, type: MergeCartResponseDto })
  async mergeGuestCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: RequestWithUser["currentUser"],
  ) {
    const guestTokenRaw = req.cookies?.[GUEST_CART_COOKIE] as string | undefined;
    const result = await this.cart.attachGuestCartToUser(user!.id, guestTokenRaw);
    if (result.merged) {
      // Le jeton invite est mort cote serveur des la fusion reussie : le
      // cookie n'a plus aucune utilite et est retire immediatement.
      res.clearCookie(GUEST_CART_COOKIE, this.guestCookieOptions());
    }
    return { merged: result.merged, cartId: result.cartId };
  }

  @Get(":cartId")
  @ApiResponse({ status: 200, type: CartResponseDto })
  getCartGuest(@Param("cartId") cartId: string, @Req() req: Request): Promise<CartDto> {
    const guestTokenRaw = req.cookies?.[GUEST_CART_COOKIE] as string | undefined;
    return this.cart.getCart(cartId, { guestTokenRaw });
  }

  @Get(":cartId/authenticated")
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: CartResponseDto })
  getCartAuthenticated(@Param("cartId") cartId: string, @CurrentUser() user: RequestWithUser["currentUser"]): Promise<CartDto> {
    return this.cart.getCart(cartId, { userId: user!.id });
  }
}
