# ADR-020 — Consommation atomique des jetons a usage unique

## Contexte
La verification email et la reinitialisation de mot de passe faisaient
lecture -> verification -> ecriture en trois etapes distinctes : deux
requetes concurrentes avec le meme jeton pouvaient toutes deux passer la
verification avant qu'aucune n'ait ecrit `consumedAt`.

## Decision
`VerificationTokenRepository.consumeEmailVerification` /
`consumePasswordReset` utilisent desormais un `updateMany` conditionnel
unique : `WHERE tokenHash = ? AND consumedAt IS NULL AND expiresAt >
NOW()`. Le nombre de lignes affectees (`count`) determine si CET appel a
reellement consomme le jeton ; en cas de `count !== 1`, le jeton est
considere invalide/deja consomme, sans lecture prealable separee.

Lors de la creation d'un nouveau jeton de reinitialisation de mot de
passe, tous les jetons actifs precedents du meme utilisateur sont
invalides dans la meme operation (`createPasswordReset`) — un seul jeton
de reinitialisation valide a la fois.

## Consequences
Deux appels concurrents avec le meme jeton : un seul reussit, l'autre
recoit `ValidationDomainError` ("jeton invalide ou expire"), sans exposer
d'information sur laquelle des deux requetes est arrivee "en premier".
