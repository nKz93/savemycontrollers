# ADR-021 — Atomicite du changement de statut de reparation

## Contexte
Le controle du verrou optimiste, la modification du statut, l'ecriture de
l'historique et l'evenement Outbox etaient quatre operations Prisma
successives non regroupees : un echec entre deux d'entre elles pouvait
laisser un dossier avec un statut modifie mais sans historique
correspondant, ou sans evenement Outbox associe.

## Decision
`RepairCaseService.changeStatus` regroupe desormais le controle du verrou
optimiste, la mise a jour du statut, l'ecriture de l'historique et
l'evenement Outbox dans **une seule transaction PostgreSQL**
(`RepairCaseRepository.runInTransaction`). Si le verrou optimiste echoue
(dossier modifie entre-temps), une erreur est levee **a l'interieur** de
la transaction, provoquant un rollback complet — aucun historique ni
evenement partiellement ecrit.

## Compromis assume : l'audit reste hors transaction
L'ecriture du journal d'audit (`AuditService.record`) utilise sa propre
connexion, hors de cette transaction. Ce choix est **deliberement
assume**, pas un oubli : un changement de statut metier valide et deja
commite ne doit jamais etre annule retroactivement a cause d'un probleme
d'ecriture d'un mecanisme d'observabilite (le journal d'audit). Le risque
residuel — un changement de statut reussi sans trace d'audit si l'ecriture
d'audit echoue juste apres le commit — est juge acceptable a ce stade et
documente ici plutot que dissimule.

## Conditions de reevaluation
Si des obligations de conformite imposent une garantie plus stricte
(aucune action sensible sans preuve d'audit correspondante), envisager
d'ecrire l'audit dans la meme transaction via le meme client `tx`, au prix
d'un couplage plus fort entre `AuditService` et chaque module appelant.
