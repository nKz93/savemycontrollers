import { z } from "zod";

export const registerRequestSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(12).max(128),
});
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerifiedAt: string | null;
  accountType: "INDIVIDUAL" | "COMPANY_MEMBER" | "STAFF";
}

export interface SessionDto {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  current: boolean;
}
