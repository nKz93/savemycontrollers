# ADR-017 — Prise de lot Outbox atomique (FOR UPDATE SKIP LOCKED)

## Contexte
Le worker precedent lisait un lot d'evenements `PENDING`
(`findMany`) puis les marquait `PROCESSING` dans un second appel : deux
instances du worker demarrees en parallele pouvaient lire et traiter le
meme lot avant qu'aucune des deux n'ait pose son marquage.

## Decision
La selection et le marquage sont regroupes dans une transaction unique
utilisant `SELECT ... FOR UPDATE SKIP LOCKED` (requete SQL brute via
`$queryRaw`, necessaire car Prisma ne l'expose pas nativement) : chaque
ligne verrouillee par une transaction concurrente est simplement ignoree
par les autres plutot qu'attendue, ce qui permet plusieurs workers
paralleles sans contention.

Champs ajoutes : `lockedAt`, `lockedBy` (identifiant du worker),
`nextAttemptAt` (backoff exponentiel plafonne a 1h), en complement de
`attempts`/`lastError`/`processedAt` deja presents.

## Recuperation des verrous perimes
Si un worker meurt entre le verrouillage et le marquage terminal (crash),
`releaseStaleLocksIfAny` remet en `PENDING` tout evenement `PROCESSING`
dont `lockedAt` depasse `OUTBOX_STALE_LOCK_MS` (5 minutes par defaut),
execute a chaque iteration de boucle.

## Dead-letter
Au-dela de `OUTBOX_MAX_ATTEMPTS`, un evenement passe en `FAILED`
definitif et n'est plus jamais repris automatiquement — consultable pour
investigation manuelle.

## Arret propre
Le worker intercepte `SIGTERM`/`SIGINT`, termine l'iteration de boucle en
cours, puis appelle `prisma.$disconnect()` avant `process.exit(0)`.
