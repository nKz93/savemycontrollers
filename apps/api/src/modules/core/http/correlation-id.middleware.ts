import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export const CORRELATION_ID_HEADER = "x-correlation-id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface RequestWithCorrelationId extends Request {
  correlationId: string;
}

/**
 * Point d'entree UNIQUE pour la resolution de l'identifiant de
 * correlation (voir section 12 du prompt de phase 2C.1) : accepte
 * uniquement un UUID valide fourni par le client, en genere un sinon
 * (jamais de valeur arbitraire stockee telle quelle dans une colonne
 * `@db.Uuid`), l'expose sur `request.correlationId`, et le renvoie dans
 * l'en-tete de reponse. Les controleurs ne doivent plus jamais
 * reimplementer cette logique (`randomUUID()` disperse dans chaque
 * handler est desormais un usage a eviter — utiliser
 * `request.correlationId`).
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers[CORRELATION_ID_HEADER];
  const candidate = Array.isArray(provided) ? provided[0] : provided;
  const correlationId = candidate && UUID_PATTERN.test(candidate) ? candidate : randomUUID();

  (req as RequestWithCorrelationId).correlationId = correlationId;
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
}
