# ADR-015 — Un UUID de panier n'est jamais une autorisation

## Contexte
`GET /cart/:id` donnait acces a n'importe quel panier par simple
connaissance de son UUID — un panier authentifie ou d'entreprise pouvait
etre lu/modifie par un tiers ayant devine ou intercepte l'identifiant.

## Decision
Trois regimes d'appartenance, tous verifies par `CartService` avant tout
acces :
- **Panier authentifie** : `cart.userId === actor.userId` strictement.
- **Panier d'entreprise** : appartenance active ET entreprise approuvee,
  verifiees via `OrganizationsPublicApi.assertActiveApprovedMember`.
- **Panier invite** : un jeton opaque aleatoire est genere a la creation,
  seul son hash SHA-256 est stocke (`Cart.guestTokenHash`) ; le jeton brut
  transite par un cookie `HttpOnly` scope a `/cart`. L'acces exige que le
  hash du jeton presente corresponde.

Un panier expire ou deja converti en commande est systematiquement
rejete, quelle que soit l'appartenance.

## Consequences
`GET /cart/:cartId` (invite) et `GET /cart/:cartId/authenticated`
(connecte) sont deux routes distinctes ; le controleur ne fait jamais
confiance a l'UUID seul.

## Conditions de reevaluation
Si un parcours de rattachement automatique "panier invite -> compte" est
implemente, il devra explicitement transferer la propriete
(`userId`) et invalider le jeton invite associe.
