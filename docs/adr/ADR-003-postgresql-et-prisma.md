# ADR-003 — PostgreSQL + Prisma

## Contexte
Le systeme manipule des donnees fortement relationnelles avec des
contraintes d'integrite critiques (commandes, stocks, facturation legale).

## Decision
PostgreSQL comme unique base relationnelle, Prisma comme ORM, un seul
schema (`prisma/schema.prisma`) partage par `apps/api` et `apps/worker` via
le package `@smc/database`.

## Alternatives etudiees
- MySQL : ecarte, fonctionnalites de contraintes/JSON legerement en retrait
  par rapport aux besoins (index partiels, types enum natifs).
- ORM alternatif (TypeORM, Drizzle) : Prisma retenu pour son typage genere
  de bout en bout et sa qualite de migration versionnee.
- Base NoSQL pour le catalogue : rejete — le configurateur a besoin de
  jointures relationnelles fiables (compatibilite, prix) que NoSQL rendrait
  fragiles et couteuses a interroger correctement.

## Consequences
- Toute donnee accedee doit passer par `getPrismaClient()` du package
  `@smc/database`, jamais par un import direct de `@prisma/client` dans un
  module metier (regle ESLint, voir ADR-005).
- Les migrations sont versionnees dans `prisma/migrations` et executees de
  facon controlee (voir strategie de deploiement).

## Limitation constatee lors de cette phase
Dans l'environnement sandbox utilise pour produire ce code, le moteur
Prisma (`libquery_engine`) n'a pas pu etre telecharge (domaine
`binaries.prisma.sh` hors de la liste blanche reseau de l'environnement),
empechant l'execution reelle de `prisma generate` / `validate` / `migrate`
/ `seed` dans cette session. Le schema a ete relu manuellement de bout en
bout ; ces commandes doivent etre executees des la premiere ouverture du
projet dans un environnement avec acces reseau standard (voir rapport de
fin de phase, section "Verifications reellement executees").

## Conditions de reevaluation
A reevaluer si un besoin de lecture massive/denormalisee (recherche
plein texte avancee, analytics temps reel) justifie l'ajout d'un moteur
complementaire (ex. index de recherche dedie) en plus de PostgreSQL.
