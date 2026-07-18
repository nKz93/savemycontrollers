# ADR-022 — Validation d'affectation technicien et permission dediee aux notes

## Contexte
`assignTechnician` acceptait n'importe quel `userId` sans verifier son
existence, son statut, ni son appartenance au personnel — un client
particulier pouvait etre affecte a un dossier. La creation de note
interne reutilisait la permission de simple lecture
(`repair.view_internal_notes`), melangeant lecture et ecriture.

## Decision
- `assignTechnician` verifie desormais, via `IdentityPublicApi` et
  `AuthorizationService` : existence du compte, statut actif,
  `accountType === "STAFF"` (jamais `INDIVIDUAL`/`COMPANY_MEMBER`), et
  possession d'au moins une permission representative du metier technicien
  (`repair.diagnose` ou `repair.change_status`).
- Nouvelle permission `repair.write_internal_notes`, distincte de
  `repair.view_internal_notes`, requise par
  `POST /staff/repair-cases/:id/internal-notes`. Le seed attribue les deux
  permissions aux roles techniques (ADMIN, WORKSHOP_MANAGER, TECHNICIAN)
  mais seulement la lecture a CUSTOMER_SUPPORT.

## Conditions de reevaluation
Si un role "lecture seule" (audit externe, stagiaire) est introduit,
verifier qu'il ne recoit que `repair.view_internal_notes`.
