# ADR-019 — Protection CSRF et separation des cookies d'authentification

## Contexte
L'authentification par cookies (necessaire pour eviter le stockage de
jetons en `localStorage`) expose structurellement a des attaques CSRF si
aucune protection dediee n'est ajoutee.

## Decision
- Protection CSRF par double-soumission de cookie (`csrf-csrf`, pattern
  eprouve) : un cookie non-`HttpOnly` porte le jeton, le frontend le
  renvoie dans l'en-tete `x-csrf-token` sur toute requete mutative.
  `GET /csrf-token` permet au frontend d'obtenir un jeton initial.
- Verification complementaire de l'en-tete `Origin`/`Referer` sur les
  methodes mutatives (`createOriginCheckMiddleware`), independante du
  jeton CSRF : une defense en profondeur, pas un remplacement.
- Cookies d'authentification separes :
  - **access token** : `HttpOnly`, `Secure` (prod), `SameSite=Lax`,
    chemin `/`, duree courte.
  - **refresh token** : `HttpOnly`, `Secure` (prod), `SameSite=Strict`
    (plus restrictif, car ce cookie ne doit jamais partir dans un contexte
    de navigation cross-site), chemin restreint a `/auth`.
- `COOKIE_DOMAIN` n'est plus jamais defini a `"localhost"` par defaut
  (voir `.env.example` — laisse vide localement) ; `validateEnv` refuse ce
  cas explicitement en production.

## Conditions de reevaluation
Si un sous-domaine dedie a l'API est introduit en production
(`api.savemycontrollers.example`), verifier que `COOKIE_DOMAIN` et
`CORS_ALLOWED_ORIGINS` restent coherents avec le nouveau schema de
domaines.
