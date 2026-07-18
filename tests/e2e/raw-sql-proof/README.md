# Preuve SQL contre PostgreSQL reel (phase 2C)

Ce dossier contient une verification **reellement executee** contre une
instance PostgreSQL 16 locale (installee via `apt-get install postgresql`,
domaine `archive.ubuntu.com` autorise), destinee a prouver la correction
de la logique SQL critique **independamment du blocage du moteur Prisma**
dans cet environnement (voir le rapport de fin de phase).

`schema.sql` traduit a la main le sous-ensemble du schema Prisma
necessaire (colonnes exactement conformes aux `@map(...)` du schema
principal). `run.mjs` utilise `pg` (node-postgres, sans dependance a
Prisma) pour executer 4 series de tests reels :

1. **30 generations concurrentes de reference** via le compteur atomique
   (`reference_counters`, meme requete SQL que
   `ReferenceGeneratorService`/`@smc/database`) — verifie l'absence de
   collision et la continuite de la sequence.
2. **5 "workers" concurrents** reclamant des lots d'evenements Outbox via
   `FOR UPDATE SKIP LOCKED` (meme requete que
   `claimOutboxBatchAtomic`) — verifie qu'aucun evenement n'est jamais
   reclame deux fois.
3. **2 checkouts concurrents** sur le meme panier via une mise a jour
   conditionnelle `WHERE converted_at IS NULL` — verifie qu'une seule
   commande est creee.
4. **10 contraintes CHECK** (montant negatif, quantite nulle, remise >100%,
   delai incoherent, adresse sans/avec double proprietaire, panier sans
   identite) — verifie le rejet ou l'acceptation exacts.

Resultat de la derniere execution : voir `RESULTS.txt` — **tous les tests
passent (aucun echec)**.

## Limitation
Ce test valide la logique SQL et les contraintes de maniere independante
du client Prisma genere. Il ne remplace pas une execution complete via
Prisma (migrations `prisma migrate`, client type que genere, etc.), qui
reste bloquee dans cet environnement (voir rapport de phase). Il constitue
neanmoins une preuve reelle, executee, que la conception SQL elle-meme est
correcte.

Pour rejouer : `node tests/e2e/raw-sql-proof/run.mjs` (necessite une base
PostgreSQL locale accessible avec les identifiants configures dans le
script, et le schema `schema.sql` prealablement charge).
