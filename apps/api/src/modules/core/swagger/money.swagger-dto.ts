import { ApiProperty } from "@nestjs/swagger";
import type { Money } from "@smc/contracts";

/**
 * Classe Swagger partagee pour tout montant (voir @smc/contracts/common/money.ts).
 * NECESSAIRE : un type litteral inline `{ amountMinor: number; currency:
 * "EUR" }` sur un champ ne peut pas etre introspecte par
 * @nestjs/swagger (design:type reflechit "Object" pour un litteral, sans
 * classe reelle) — le schema genere serait vide et amountMinor
 * deviendrait undefined dans le client TypeScript genere. Meme famille de
 * bug que les champs nullable sans `type:` explicite.
 */
export class MoneyResponseDto implements Money {
  @ApiProperty() amountMinor!: number;
  @ApiProperty({ example: "EUR" }) currency!: "EUR";
}
