# ADR-006 — Outbox Pattern pour les evenements metier

## Contexte
Une commande cree simultanement une ligne `Order`, des `RepairCase`, et
doit declencher des effets de bord asynchrones (email, PDF...). Publier ces
evenements directement sur une file (BullMQ) au moment de la mutation
metier cree un risque de desynchronisation si la transaction SQL echoue
apres la publication, ou si la publication echoue apres le commit.

## Decision
Chaque evenement metier est ecrit dans la table `outbox_events` **dans la
meme transaction Prisma** que la mutation qui le declenche
(`OutboxRepository.appendInTransaction(tx, event)`). Le worker
(`apps/worker`) consomme ensuite ces evenements par polling (voir
ADR ci-dessous sur le choix du polling), de facon idempotente
(statuts `PENDING` -> `PROCESSING` -> `PROCESSED`/`FAILED`, avec compteur
de tentatives).

## Alternatives etudiees
- Publication directe sur BullMQ au moment de la mutation : rejete — pas
  atomique avec la transaction SQL.
- PostgreSQL `LISTEN`/`NOTIFY` : ecarte pour cette phase au profit d'un
  polling simple (intervalle configurable), suffisant au volume cible
  (hypothese H12) et operationnellement plus simple ; migration possible
  sans changer le contrat des handlers.
- Kafka / bus d'evenements distribue : explicitement exclu par le prompt de
  phase (infrastructure disproportionnee pour ce volume).

## Consequences
- Garantie "at-least-once" : les handlers du worker (`handleOutboxEvent`)
  doivent etre idempotents (voir tests `outbox-event-handler.spec.ts`).
- Traçabilite complete (`correlationId` propage de la requete HTTP jusqu'a
  l'evenement consomme).

## Conditions de reevaluation
Passer a `LISTEN`/`NOTIFY` ou a une file evenementielle pure si la latence
du polling (2 secondes par defaut) devient un probleme mesure en
production.
