import { z } from "zod";

/**
 * Un montant est toujours exprime en unite mineure (centimes) sous forme
 * d'entier, jamais en nombre flottant, et toujours accompagne de sa devise.
 * Voir ADR-007-montants-en-unites-mineures.md
 */
export const moneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.enum(["EUR"]),
});
export type Money = z.infer<typeof moneySchema>;
