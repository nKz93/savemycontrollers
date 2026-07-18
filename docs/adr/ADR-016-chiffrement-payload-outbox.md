# ADR-016 — Chiffrement applicatif des charges utiles sensibles de l'Outbox

## Contexte
Le jeton brut de verification email transitait en clair dans
`outbox_events.payload` (JSON), une table PostgreSQL ordinaire
potentiellement presente dans des sauvegardes non chiffrees.

## Decision
Le paquet partage `@smc/crypto` (AES-256-GCM, cle `PAYLOAD_ENCRYPTION_KEY`
base64 32 octets) chiffre toute valeur sensible avant ecriture dans
`payload`. Le champ `OutboxEvent.payloadEncrypted` (booleen) signale au
worker qu'il doit dechiffrer avant utilisation. Le worker ne journalise
jamais le texte en clair (voir `redactEmail` dans le handler).

`PAYLOAD_ENCRYPTION_KEY` est obligatoire en production (voir
`config/env.schema.ts`) ; en developpement, une cle ephemere est generee
en memoire si absente (avec avertissement), pour ne pas bloquer le
demarrage local.

## Alternatives etudiees
- Table temporaire dediee a retention courte pour les secrets : rejetee
  au profit du chiffrement applicatif, plus simple a operer (pas de job de
  purge supplementaire a maintenir) et applicable uniformement a tout
  futur evenement sensible.

## Conditions de reevaluation
Envisager une purge complementaire des evenements `PROCESSED` anciens
(politique de retention) en phase suivante, une fois le volume reel
observe.
