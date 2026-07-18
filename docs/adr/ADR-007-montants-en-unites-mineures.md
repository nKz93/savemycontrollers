# ADR-007 — Montants en unites mineures (centimes), jamais en flottant

## Contexte
Les calculs monetaires en nombre flottant (IEEE 754) produisent des erreurs
d'arrondi inacceptables pour de la facturation.

## Decision
Tout montant est stocke et manipule comme un **entier** representant les
centimes (`amountMinor`), toujours accompagne d'une devise
(`Currency` enum, `EUR` seul membre au MVP). Le contrat partage
`@smc/contracts` (`moneySchema`) impose `z.number().int()`. Les arrondis de
TVA utilisent `Math.round` sur des entiers (`Math.round((base * tauxBp) /
10000)`), jamais de division flottante non arrondie.

## Alternatives etudiees
- `number` flottant en euros (ex. `19.99`) : rejete — non fiable pour des
  sommes/soustractions repetees (voir tests `configurator.service.spec.ts`
  qui verifient explicitement `Number.isInteger` sur chaque composante du
  prix).
- Type `Decimal` (bibliotheque dediee) : envisageable en phase suivante si
  des taux non entiers de points de base sont necessaires ; les entiers
  suffisent au perimetre actuel (points de base = entiers).

## Consequences
- Toute nouvelle fonctionnalite manipulant un prix doit reutiliser
  `amountMinor` + `currency`, jamais introduire un flottant "pour
  simplifier".

## Conditions de reevaluation
Aucune prevue : ce choix est structurant et ne doit pas etre remis en
cause sans migration complete des donnees financieres existantes.
