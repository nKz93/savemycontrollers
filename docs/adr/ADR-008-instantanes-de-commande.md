# ADR-008 — Instantanes immuables de commande (OrderItem snapshots)

## Contexte
Le catalogue (prix, noms, options) evolue dans le temps. Une commande
passee doit rester lisible et juridiquement stable meme si le catalogue
change ensuite.

## Decision
`OrderItem` stocke un instantane complet et denormalise au moment de la
commande : `deviceModelNameSnapshot`, `deviceVariantNameSnapshot`,
`unitPriceMinorSnapshot`, `taxRateBasisPointsSnapshot`,
`taxAmountMinorSnapshot`, `totalMinorSnapshot`, ainsi que des tables de
jonction dediees `OrderItemServiceSnapshot` / `OrderItemOptionSnapshot`
(nom + prix figes, cle etrangere vers le service d'origine conservee mais
`onDelete: SetNull` pour ne jamais bloquer une suppression future du
catalogue).

## Alternatives etudiees
- Recalcul a la volee a partir des ID stockes uniquement : rejete —
  viole l'exigence explicite (section 12 du prompt) et rendrait une facture
  incoherente si le prix change apres coup.
- Stockage JSON libre du panier au moment de la commande : rejete au profit
  de tables relationnelles typees (voir principe general "pas de JSON comme
  raccourci de modelisation", section 9 du prompt) — permet des requetes
  fiables (ex. statistiques de vente par prestation) sans parser du JSON.

## Consequences
- Duplication volontaire de donnees (nom, prix) entre le catalogue et la
  commande : c'est le but recherche, pas un defaut.

## Conditions de reevaluation
Aucune : ce choix est une exigence metier et legale, pas une optimisation
technique reversible.
