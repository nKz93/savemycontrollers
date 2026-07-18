# ADR-012 — References commerciales generees par compteur atomique

## Contexte
La phase 2 generait des references (`SMC-2026-000123`) par tirage aleatoire
d'un suffixe, avec un commentaire affirmant un retry en cas de collision
qui n'existait pas reellement.

## Decision
`ReferenceGeneratorService` (deplace dans `modules/core`, voir ADR-013)
utilise une table `reference_counters (scope, year, last_value)` et une
instruction `INSERT ... ON CONFLICT DO UPDATE SET last_value = last_value
+ 1 RETURNING last_value`, atomique au niveau ligne PostgreSQL : deux
appels concurrents obtiennent necessairement deux valeurs strictement
distinctes, sans verrou explicite ni retry applicatif necessaire.

## Alternatives etudiees
- Sequence PostgreSQL native (`CREATE SEQUENCE`) : equivalente en
  garantie, mais moins flexible pour gerer plusieurs perimetres (ORDER,
  REPAIR) par annee sans creer une sequence par annee dynamiquement.
- UUID comme reference commerciale : rejete, une reference doit rester
  lisible et communicable par telephone (voir section 9 de
  l'architecture).

## Consequences
Le format `SMC-ORD-AAAA-NNNNNN` / `SMC-AAAA-NNNNNN` est conserve. Le
compteur deborde a 999999 par (perimetre, annee) : une erreur explicite
est levee plutot que de tronquer silencieusement (tres improbable au
volume cible, hypothese H12).
