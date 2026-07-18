# ADR-009 — QR codes opaques, jamais d'URL authentifiee a courte expiration

## Contexte
Le prompt de phase interdit explicitement d'encoder dans le QR code du
dossier une URL authentifiee a expiration courte (fuite possible via
photo/partage, expiration genante en atelier).

## Decision
Le QR code encode un **jeton opaque** genere aleatoirement
(`randomBytes(32)`, encodage base64url), non predictible, sans donnee
personnelle ni identifiant sequentiel. Seul son hash SHA-256
(`RepairCase.qrTokenHash`) est stocke en base. Le jeton est revocable
(`qrTokenRevokedAt`) et renouvelable (regenerer un nouveau hash, invalider
l'ancien). Le scan par un technicien authentifie resout le jeton cote
serveur pour retrouver le dossier ; une eventuelle page de suivi public
utilisera un jeton distinct avec des informations volontairement limitees
(prevu en phase suivante).

## Alternatives etudiees
- URL signee a expiration courte encodee dans le QR : rejetee
  explicitement par le prompt de phase — un QR colle sur un colis doit
  rester utilisable pendant toute la duree de la reparation (semaines),
  pas quelques minutes.
- Identifiant sequentiel (UUID du dossier) encode en clair : rejete — un
  identifiant devinable/enumerable exposerait indirectement des dossiers
  via essais successifs si un endpoint de lecture n'etait pas correctement
  protege.

## Consequences
- Le token brut n'existe qu'un instant (a la generation, transmis pour
  impression) : il n'est jamais journalise en clair, ni renvoye par un
  endpoint de lecture ulterieur.

## Conditions de reevaluation
Si une page de suivi public (sans authentification) est developpee, elle
devra utiliser un jeton different de celui de l'atelier, avec un
perimetre de donnees explicitement restreint (voir section 14 du prompt).
