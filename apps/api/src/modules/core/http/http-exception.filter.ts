import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { DomainError } from "../errors/domain-error.js";

/**
 * Filtre d'exception global : garantit un format d'erreur unique
 * (voir @smc/contracts ApiErrorResponse), n'expose jamais de detail
 * interne (stack trace, message Prisma brut) en production, et attache
 * un correlationId reutilisable dans les logs et l'audit.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ?? randomUUID();

    if (exception instanceof DomainError) {
      response.status(exception.httpStatus).json({
        error: {
          code: exception.code,
          message: exception.message,
          correlationId,
          details: exception.details,
        },
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json({
        error: {
          code: HttpStatus[status] ?? "HTTP_ERROR",
          message: exception.message,
          correlationId,
        },
      });
      return;
    }

    // Erreur non anticipee : jamais de detail interne renvoye au client.
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Une erreur interne est survenue.",
        correlationId,
      },
    });
  }
}
