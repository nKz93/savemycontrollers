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
      const body = exception.getResponse();
      // BUG REEL CORRIGE : quand une HttpException est construite avec un
      // OBJET enrichi (voir ZodValidationPipe, qui passe
      // { error: { code, message, details } } pour exposer le detail des
      // champs invalides), `exception.message` retombe sur le texte
      // generique par defaut de NestJS ("Bad Request Exception" etc.) —
      // le corps enrichi n'est accessible que via getResponse(). Toute
      // erreur de validation de toute l'API perdait donc son detail utile
      // avant ce correctif (trouve par la CI E2E reelle : un message
      // generique et non exploitable remontait jusqu'au navigateur).
      const enrichedError = isEnrichedErrorBody(body) ? body.error : null;
      response.status(status).json({
        error: {
          code: enrichedError?.code ?? (HttpStatus[status] ?? "HTTP_ERROR"),
          message: enrichedError?.message ?? exception.message,
          correlationId,
          ...(enrichedError?.details !== undefined ? { details: enrichedError.details } : {}),
        },
      });
      return;
    }

    // Erreur non anticipee : jamais de detail interne renvoye au client
    // EN PRODUCTION. Hors production (dev, CI, validation E2E), le
    // message reel est inclus pour permettre le diagnostic — sans cela,
    // toute erreur non geree remonte comme "Une erreur interne est
    // survenue." sans aucune piste, meme dans les environnements de test.
    const isProduction = process.env.NODE_ENV === "production";
    const rawMessage = exception instanceof Error ? exception.message : String(exception);
    response.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Une erreur interne est survenue.",
        correlationId,
        ...(isProduction ? {} : { debugDetail: rawMessage }),
      },
    });
  }
}

function isEnrichedErrorBody(
  body: unknown,
): body is { error: { code?: string; message?: string; details?: unknown } } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error: unknown }).error === "object" &&
    (body as { error: unknown }).error !== null
  );
}
