# ADR-014 — Rotation atomique des refresh tokens avec detection de reutilisation

## Contexte
La rotation precedente revoquait puis recreait une session en deux
operations non conditionnelles : deux appels `/auth/refresh` concurrents
avec le meme refresh token pouvaient tous deux reussir, et un refresh
token vole rejoue apres rotation legitime n'etait pas detecte comme
anomalie.

## Decision
- Chaque `Session` porte un `familyId` (UUID), commun a toutes les
  rotations issues d'une meme connexion initiale.
- La rotation (`SessionRepository.rotateIfActive`) revoque l'ancienne
  session par un `updateMany` conditionnel (`WHERE id = ? AND revokedAt IS
  NULL`) : seul l'appelant qui "gagne" cette condition peut creer la
  nouvelle session.
- Si la revocation echoue (`count === 0`), la session avait deja ete
  revoquee — par une rotation concurrente legitime OU par la reutilisation
  d'un jeton deja consomme. Dans les deux cas, par prudence, **toute la
  famille de sessions est revoquee** (`revokeFamily`) et l'appel echoue :
  a la fois l'attaquant potentiel et l'utilisateur legitime doivent se
  reconnecter. C'est le compromis de securite standard pour ce pattern
  (voir OWASP Refresh Token Rotation).

## Consequences
- Deux rotations strictement simultanees avec le meme refresh token :
  une seule reussit, l'autre echoue avec `ForbiddenDomainError` — jamais
  deux sessions valides issues du meme jeton.
- `revokedReason` (`ROTATED`, `REUSE_DETECTED`, `LOGOUT`,
  `USER_REVOKED_ALL`, `PASSWORD_RESET`) est journalise pour l'audit et le
  diagnostic.

## Conditions de reevaluation
Aucune prevue : ce mecanisme suit une pratique reconnue et n'a pas de
raison d'etre assoupli.
