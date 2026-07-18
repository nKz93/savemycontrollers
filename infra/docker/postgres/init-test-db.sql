-- Cree automatiquement la base de test au demarrage du conteneur
-- PostgreSQL de developpement, pour que `pnpm test:integration`
-- fonctionne sans etape manuelle supplementaire.
CREATE DATABASE smc_test OWNER smc;
