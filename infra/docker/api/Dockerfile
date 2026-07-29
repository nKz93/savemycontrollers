# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# BUG REEL CORRIGE : sans prisma generate ici, @prisma/client n'a pas de
# types generes — Prisma.TransactionClient (utilise dans
# packages/database/src/outbox-claim.ts) retombe alors sur `any` en
# cascade, et tsup --dts echoue avec "implicitly has an 'any' type"
# (TS7006) en mode strict. Jamais detecte par la CI habituelle (qui,
# elle, genere reellement le client avant le build) — revele uniquement
# par un vrai build Docker independant.
RUN pnpm --filter @smc/database generate
# Construit les packages partages PUIS l'API, dans l'ordre de dependance
# Turborepo (turbo.json: build depend de ^build). Aucune erreur n'est
# masquee : si un package partage echoue, l'image ne se construit pas.
RUN pnpm turbo run build --filter=@smc/api...

FROM node:20-alpine AS runtime
# BUG REEL CORRIGE : sans openssl installe, Prisma ne detecte pas la
# version libssl disponible sur Alpine (musl) et tente de telecharger/
# ecrire un moteur de secours dans node_modules au demarrage — ce qui
# echoue puisque le conteneur tourne avec l'utilisateur non-root 'smc'
# (permissions en lecture seule). Trouve en deployant reellement
# (Coolify) : "Error: Can't write to .../@prisma/engines please make
# sure you install 'prisma' with the right permissions."
RUN apk add --no-cache openssl
RUN corepack enable && addgroup -S smc && adduser -S smc -G smc
WORKDIR /app
ENV NODE_ENV=production
# Les migrations Prisma NE SONT PAS executees ici : elles doivent l'etre
# separement, avant le demarrage de ce conteneur (voir
# infra/scripts/reset-local-env.sh ou une etape dediee de deploiement).
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/prisma ./prisma
USER smc
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
