# ADR-001 — Monolithe modulaire plutot que microservices

## Contexte
Le document d'architecture (phase 1) devait choisir entre un decoupage en
microservices et un monolithe modulaire pour le backend NestJS.

## Decision
Backend developpe comme un **monolithe modulaire unique** (`apps/api`),
organise en modules NestJS strictement isoles (voir ADR-005), avec un
processus `apps/worker` separe pour les traitements asynchrones (Outbox).

## Alternatives etudiees
- **Microservices par domaine** (Orders, Repairs, Payments...) communiquant
  par API/evenements : rejete pour cette phase — complexite operationnelle
  (orchestration, observabilite distribuee, coherence transactionnelle par
  sagas) disproportionnee par rapport au volume cible du MVP.
- **Monolithe non modulaire** (un seul gros module) : rejete — bloquerait
  toute extraction future et favoriserait le couplage.

## Consequences
- Transactions ACID natives entre commande, dossier de reparation et
  evenement Outbox (voir ADR-006).
- Deploiement simplifie (une seule application a versionner/deployer, plus
  le worker).
- Le respect strict des frontieres de module (ADR-005) est une condition
  necessaire pour qu'une extraction ulterieure en microservices reste
  possible sans reecriture complete.

## Risques
- Sans discipline, le monolithe peut degenerer en "big ball of mud" —
  mitigation : regle ESLint `no-restricted-imports` + revue de code
  systematique sur les imports inter-modules.

## Conditions de reevaluation
A reevaluer si le volume de commandes/mois depasse largement l'hypothese
H12 (quelques centaines de dossiers/mois) ou si des equipes distinctes
doivent deployer independamment des domaines metier differents.
