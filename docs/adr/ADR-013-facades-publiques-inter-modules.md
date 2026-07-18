# ADR-013 — Facades publiques obligatoires entre modules

## Contexte
La phase 2 laissait Orders et Configurator importer directement
`ServiceRepository`/`DeviceModelRepository` du module Catalog, violant la
regle de frontiere deja enoncee (ADR-005) mais non appliquee dans les
faits.

## Decision
Chaque module expose desormais une facade unique `<Module>PublicApi`
(`CatalogPublicApi`, `ConfiguratorPublicApi`, `OrganizationsPublicApi`,
`RepairsPublicApi`, `IdentityPublicApi`) et **seule cette facade** est
exportee par le `@Module`. Les repositories et services internes ne sont
plus exportes. `ReferenceGeneratorService`, utilise a la fois par Orders
et Repairs, est deplace dans `CoreModule` plutot que de rester dans un
module metier consomme par un autre (violation symetrique detectee par le
test de demarrage, voir ADR-011).

## Application reelle
Le tarif professionnel (`trustedCompanyId`) transite desormais
exclusivement par un parametre serveur explicite de
`ConfiguratorPublicApi.validate(input, trustedCompanyId?)`, jamais par un
champ du contrat public (voir ADR-014... non, voir section dediee tarifs
pro plus bas). Le contrat `ValidateConfigurationRequest` ne contient plus
de `companyId` du tout : impossible pour un client anonyme de le fournir.

## Verification automatisee
`eslint-plugin-boundaries` est ajoute aux dependances de
`packages/eslint-config` (regle `no-restricted-imports` sur les motifs
`**/modules/*/repositories/*`) et le test de demarrage verifie que le
graphe de dependances Nest reste coherent avec ces frontieres.

## Conditions de reevaluation
Si une facade devient un point de congestion (trop de methodes
heterogenes), la scinder en plusieurs interfaces specialisees plutot que
d'autoriser un acces direct aux repositories.
