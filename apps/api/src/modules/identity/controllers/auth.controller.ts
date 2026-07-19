import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards, UsePipes } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { RedisRateLimitGuard, RedisRateLimit } from "../../core/security/redis-rate-limit.guard.js";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ApiBody, ApiResponse, ApiTags } from "@nestjs/swagger";
import {
  loginRequestSchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
  type AuthenticatedUserDto,
} from "@smc/contracts";
import { ZodValidationPipe } from "../../core/http/zod-validation.pipe.js";
import { AuthService } from "../services/auth.service.js";
import { JwtAuthGuard, type RequestWithUser } from "../guards/jwt-auth.guard.js";
import { CurrentUser } from "../decorators/current-user.decorator.js";
import { TokenService } from "../services/token.service.js";
import {
  RegisterBodyDto,
  LoginBodyDto,
  ResetPasswordBodyDto,
  AuthenticatedUserResponseDto,
  SessionResponseDto,
  MessageResponseDto,
} from "../swagger/auth.swagger-dto.js";

const REFRESH_COOKIE = "smc_refresh_token";
const ACCESS_COOKIE = "smc_access_token";

/**
 * Tous les tokens transitent par des cookies HttpOnly + Secure (en
 * production) + SameSite=Lax. Aucun token n'est jamais renvoye dans le
 * corps de la reponse JSON (voir section 7 du prompt de phase).
 */
@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly tokens: TokenService) {}

  private accessCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
      maxAge: this.tokens.accessTokenTtlMs,
      path: "/",
    };
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // SameSite strict pour le refresh token : il ne doit etre envoye que
      // dans le contexte de navigation direct du site (jamais suite a une
      // navigation cross-site), contrairement a l'access token qui peut
      // avoir besoin de Lax pour certains parcours de redirection.
      sameSite: "strict" as const,
      ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
      maxAge: this.tokens.refreshTokenTtlMs,
      // Chemin restreint aux endpoints d'authentification : le refresh
      // token n'a pas besoin d'etre envoye sur les autres routes de l'API.
      path: "/auth",
    };
  }

  @Post("register")
  @UseGuards(RedisRateLimitGuard)
  @RedisRateLimit({ limit: 5, windowSeconds: 3600, byEmail: true })
  @ApiBody({ type: RegisterBodyDto })
  @ApiResponse({ status: 201, type: MessageResponseDto })
  @UsePipes(new ZodValidationPipe(registerRequestSchema))
  async register(@Body() body: RegisterRequest, @Req() req: Request) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? randomUUID();
    await this.auth.register(body, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      correlationId,
    });
    return { message: "Votre compte a ete cree. Verifiez votre boite mail pour l'activer." };
  }

  @Post("verify-email")
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @HttpCode(200)
  async verifyEmail(@Body("token") token: string) {
    await this.auth.verifyEmail(token);
    return { message: "Adresse email verifiee." };
  }

  @Post("login")
  // Le rate limiting reel et distribue est assure par RedisRateLimitGuard
  // (route + IP + email normalise). Le ThrottlerGuard global (app.module.ts)
  // reste actif comme garde-fou generique a un seuil plus large ; il n'est
  // pas duplique ici pour eviter toute interference entre les deux couches.
  @UseGuards(RedisRateLimitGuard)
  @RedisRateLimit({ limit: 10, windowSeconds: 60, byEmail: true })
  @ApiBody({ type: LoginBodyDto })
  @ApiResponse({ status: 200, type: AuthenticatedUserResponseDto })
  @ApiResponse({ status: 401, description: "Identifiants invalides." })
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(loginRequestSchema))
  async login(@Body() body: LoginRequest, @Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthenticatedUserDto> {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? randomUUID();
    const { user, accessToken, rawRefreshToken } = await this.auth.login(body, {
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      correlationId,
    });
    res.cookie(ACCESS_COOKIE, accessToken, this.accessCookieOptions());
    res.cookie(REFRESH_COOKIE, rawRefreshToken, this.refreshCookieOptions());
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      accountType: user.accountType,
    };
  }

  @Post("refresh")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!rawRefreshToken) return { message: "Aucune session active." };
    const correlationId = (req.headers["x-correlation-id"] as string) ?? randomUUID();
    const { accessToken, rawRefreshToken: newRefresh } = await this.auth.refresh(rawRefreshToken, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
      correlationId,
    });
    res.cookie(ACCESS_COOKIE, accessToken, this.accessCookieOptions());
    res.cookie(REFRESH_COOKIE, newRefresh, this.refreshCookieOptions());
    return { message: "Session renouvelee." };
  }

  @Post("logout")
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (rawRefreshToken) await this.auth.logout(rawRefreshToken);
    res.clearCookie(ACCESS_COOKIE, this.accessCookieOptions());
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
    return { message: "Deconnecte." };
  }

  @Post("forgot-password")
  @UseGuards(RedisRateLimitGuard)
  @RedisRateLimit({ limit: 5, windowSeconds: 3600, byEmail: true })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @HttpCode(200)
  async forgotPassword(@Body("email") email: string) {
    await this.auth.requestPasswordReset(email);
    // Reponse identique que l'email existe ou non (anti-enumeration).
    return { message: "Si un compte existe, un email de reinitialisation a ete envoye." };
  }

  @Post("reset-password")
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiBody({ type: ResetPasswordBodyDto })
  @ApiResponse({ status: 200, type: MessageResponseDto })
  @HttpCode(200)
  @UsePipes(new ZodValidationPipe(resetPasswordRequestSchema))
  async resetPassword(@Body() body: ResetPasswordRequest) {
    await this.auth.resetPassword(body.token, body.newPassword);
    return { message: "Mot de passe reinitialise." };
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  @ApiResponse({ status: 200, type: [SessionResponseDto] })
  async listSessions(@CurrentUser() user: RequestWithUser["currentUser"], @Req() req: Request) {
    const currentSessionHash = req.cookies?.[REFRESH_COOKIE]
      ? this.tokens.hashOpaqueToken(req.cookies[REFRESH_COOKIE] as string)
      : undefined;
    return this.auth.listSessions(user!.id, currentSessionHash);
  }
}
