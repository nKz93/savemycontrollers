# ADR-002 — Structure des applications (deux frontends, pas quatre)

## Contexte
Le document d'architecture initial (phase 1) proposait quatre applications
Next.js distinctes (public, client, professionnel, atelier/admin). Le prompt
de phase 2 demande de simplifier a deux applications.

## Decision
Deux applications Next.js :
- `apps/web` : site public + espace client + portail professionnel, separes
  par des groupes de routes (`(public)`, `(client)`, `(pro)`) avec layouts
  distincts.
- `apps/ops` : back-office administratif + interface atelier (PWA, mobile-
  first), separes par des groupes de routes (`(dashboard)`, `(workshop)`).

`apps/api` (NestJS) et `apps/worker` (BullMQ) restent deux processus
distincts partageant des packages (`@smc/database`, `@smc/contracts`...).

## Alternatives etudiees
- Quatre applications Next.js distinctes : rejete — duplique la
  configuration (design system, i18n, build) sans benefice reel a ce stade,
  alourdit le monorepo et le CI.

## Consequences
- Un seul design system (`@smc/ui`) consomme par les deux frontends.
- Les groupes de routes imposent une discipline claire : aucun composant
  d'un groupe ne doit fuiter dans un autre sans passer par `@smc/ui`.

## Conditions de reevaluation
Si le portail professionnel ou l'atelier necessitent un cycle de deploiement
totalement independant (ex. equipe dediee), une extraction en application
Next.js separee reste possible sans changer l'API.
