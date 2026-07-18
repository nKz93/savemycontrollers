import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { RequestWithUser } from "../guards/jwt-auth.guard.js";

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return request.currentUser;
});
