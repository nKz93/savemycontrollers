import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { RegisterRequest, LoginRequest, ResetPasswordRequest, AuthenticatedUserDto, SessionDto } from "@smc/contracts";

export class RegisterBodyDto implements RegisterRequest {
  @ApiProperty() email!: string;
  @ApiProperty({ description: "12 caracteres minimum." }) password!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
}

export class LoginBodyDto implements LoginRequest {
  @ApiProperty() email!: string;
  @ApiProperty() password!: string;
}

export class ResetPasswordBodyDto implements ResetPasswordRequest {
  @ApiProperty() token!: string;
  @ApiProperty({ description: "12 caracteres minimum." }) newPassword!: string;
}

export class AuthenticatedUserResponseDto implements AuthenticatedUserDto {
  @ApiProperty() id!: string;
  @ApiProperty() email!: string;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) emailVerifiedAt!: string | null;
  @ApiProperty({ enum: ["INDIVIDUAL", "COMPANY_MEMBER", "STAFF"] }) accountType!: AuthenticatedUserDto["accountType"];
}

export class SessionResponseDto implements SessionDto {
  @ApiProperty() id!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty() lastUsedAt!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) userAgent!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) ipAddress!: string | null;
  @ApiProperty() current!: boolean;
}

/** Reponse generique {message} utilisee par plusieurs routes (register, logout, forgot-password...). */
export class MessageResponseDto {
  @ApiProperty() message!: string;
}
