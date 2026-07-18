# ADR-004 — Authentification par cookies HttpOnly + refresh token rotatif

## Contexte
L'authentification doit resister au vol de token cote client (XSS) et
permettre une revocation fiable des sessions.

## Decision
- Mots de passe haches en Argon2id (`PasswordService`).
- Access token JWT signe HMAC, duree de vie courte (15 min par defaut),
  transmis via cookie `HttpOnly` + `Secure` (production) + `SameSite=Lax`.
- Refresh token opaque (aleatoire, non-JWT), duree de vie longue (30 jours
  par defaut), stocke cote base **uniquement sous forme de hash SHA-256**
  (`Session.refreshTokenHash`), transmis lui aussi via cookie `HttpOnly`.
- Rotation du refresh token a chaque `/auth/refresh` : l'ancienne session
  est revoquee, une nouvelle est creee.
- Aucun token n'est jamais renvoye dans le corps JSON ni stocke en
  `localStorage`.

## Alternatives etudiees
- Session serveur classique (cookie + store Redis) : ecarte pour cette
  phase — le couple JWT court + refresh rotatif offre un bon compromis
  scalabilite/simplicite sans session store supplementaire pour l'access
  token (le refresh, lui, est bien en base pour permettre la revocation).
- Access token en `localStorage` : rejete — expose au XSS.

## Consequences
- Toute fuite de la table `sessions` ne permet pas de rejouer une session
  (seul le hash est stocke).
- La revocation d'une session est immediate (`revokedAt`), contrairement a
  un JWT pur qui resterait valide jusqu'a expiration.

## Conditions de reevaluation
Ajout de TOTP (MFA) prevu en phase suivante sans remise en cause de ce
mecanisme (point d'integration deja identifie dans `AuthService`).
