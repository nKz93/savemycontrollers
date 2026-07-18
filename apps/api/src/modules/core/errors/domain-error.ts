/**
 * Erreur metier de base. Chaque module definit ses propres sous-classes
 * (ex. RepairCaseNotFoundError) plutot que de lancer des erreurs generiques,
 * afin que le filtre d'exception global (voir http/http-exception.filter.ts)
 * puisse produire un code d'erreur stable et documente pour le frontend.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;

  constructor(message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundDomainError extends DomainError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;
}

export class ConflictDomainError extends DomainError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;
}

export class ForbiddenDomainError extends DomainError {
  readonly code = "FORBIDDEN";
  readonly httpStatus = 403;
}

export class ValidationDomainError extends DomainError {
  readonly code = "VALIDATION_ERROR";
  readonly httpStatus = 422;
}

export class OptimisticLockDomainError extends DomainError {
  readonly code = "OPTIMISTIC_LOCK_CONFLICT";
  readonly httpStatus = 409;
}
