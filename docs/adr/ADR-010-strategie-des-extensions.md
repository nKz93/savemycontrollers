# ADR-010 — Strategie des extensions : preparation sans execution de code non controle

## Contexte
Le systeme doit a terme accueillir des extensions (transporteurs, moyens de
paiement...) sans jamais executer de code tiers non audite dans le
processus principal.

## Decision (phase actuelle)
Cette phase ne construit **pas** le moteur d'extensions complet. Elle
prepare uniquement :
- les interfaces publiques necessaires (chaque module expose deja une
  `*.public-api.ts`, point d'accroche naturel pour une future extension) ;
- les tables `ExtensionManifest` / `ExtensionEventLog` (metadonnees,
  statut, journal), sans mecanisme de chargement dynamique de code ;
- le format de manifeste documente dans le document d'architecture
  (identifiant, version, permissions, compatibilite).

Aucune route d'upload/activation d'extension n'est exposee dans cette
phase : ce serait une fonctionnalite simulee (interdit par les regles de
travail), pas une preparation honnete.

## Alternatives etudiees
- Sandbox `vm2`/isolate JS pour executer du code tiers immediatement :
  rejete pour cette phase — une sandbox mal isolee est pire qu'aucune
  sandbox (faux sentiment de securite). Le prompt demande explicitement de
  ne pas presenter un acces indirect a la base ou une interface TypeScript
  comme une sandbox de securite.
- Extensions executees en processus separe (isolation par OS) : c'est la
  direction retenue pour la phase d'implementation complete de l'ADR
  d'origine (section 22 du document d'architecture), mais son
  implementation reelle est hors perimetre de cette phase.

## Consequences
- Les futures extensions avec code devront systematiquement passer par une
  revue humaine + signature + deploiement controle (jamais un upload direct
  execute a chaud en production), conformement a la strategie decrite dans
  le document d'architecture (section 22).

## Conditions de reevaluation
A l'ouverture du chantier "moteur d'extensions" (phase ulterieure), cet ADR
devra etre remplace par un ADR decrivant le mecanisme d'isolation reel
choisi (processus separe, permissions verifiees a l'exécution, etc.).
