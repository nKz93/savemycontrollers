# ADR-023 — Securite des fichiers et types PostgreSQL natifs

## Securite des fichiers
- Le type MIME declare par le navigateur n'est plus jamais une source de
  verite : `FileService.upload` detecte le type reel par signature binaire
  (`file-type`, import dynamique car paquet ESM pur) et rejette toute
  incoherence entre le type declare et le contenu reel.
- La cle de stockage S3 ne contient plus jamais le nom de fichier fourni
  par l'utilisateur (uniquement un UUID et une extension deduite du type
  reel) ; le nom d'origine est assainit (`sanitizeDisplayFileName`) et
  conserve separement en base pour l'affichage.
- `getSignedUrl(fileId)` sans contexte utilisateur est supprimee et
  remplacee par `getSignedUrlForActor(fileId, actor)`, qui verifie la
  visibilite (`PRIVATE`/`CLIENT`/`INTERNAL`) et la propriete ou le droit
  d'acces staff avant de generer toute URL signee.
- Point d'integration explicite pour une analyse antivirus asynchrone
  (non implementee cette phase, documentee comme extension future).

## Types PostgreSQL natifs
Avant toute premiere migration, le schema declare explicitement :
- `@db.Uuid` sur chaque identifiant technique et cle etrangere (149
  champs) plutot que le `text` implicite ;
- `@db.Timestamptz(3)` sur chaque champ `DateTime` devant representer un
  instant UTC (80 champs) ;
- des longueurs `@db.VarChar(n)` sur les champs les plus sensibles
  (email, nom, reference commerciale, SKU).

Les contraintes SQL complementaires que Prisma ne peut pas exprimer
nativement (montants positifs, taux de TVA dans une plage valide, quantite
strictement positive, remise entre 0 et 100%, exactement un proprietaire
utilisateur ou entreprise) sont **preparees mais non appliquees** dans
cette phase : leur application reelle necessite une migration executee
dans un environnement disposant d'un acces reseau standard vers le moteur
Prisma (voir le rapport de fin de phase). Elles devront etre ajoutees
manuellement au fichier de migration SQL genere, avant application, comme
demande explicitement par la section 24 du prompt.
