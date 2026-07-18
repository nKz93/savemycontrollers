import { BadRequestException, type PipeTransform } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Tout DTO d'entree de l'API doit etre valide contre un schema zod partage
 * depuis @smc/contracts (source de verite unique entre frontend et backend).
 * En cas d'echec, renvoie 400 avec le detail des champs invalides — jamais
 * un 500, jamais une acceptation silencieuse d'une forme invalide.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Donnees invalides.",
          details: result.error.flatten(),
        },
      });
    }
    return result.data;
  }
}
