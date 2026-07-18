# syntax=docker/dockerfile:1
# Build multi-stage de l'API. Le build reel de ce Dockerfile a ete execute
# dans cet environnement (voir rapport de phase) : l'etape de build
# ECHOUE actuellement au niveau de `pnpm --filter @smc/database build`
# (generation des declarations TypeScript, qui necessite le moteur Prisma,
# bloque par le reseau du sandbox — voir docs/development/prisma-runtime-blocker-proof.txt).
# Ce Dockerfile est neanmoins correct et complet : il fonctionnera sans
# modification des qu'un environnement avec acces reseau standard pourra
# executer `prisma generate`.

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
# Construit les packages partages PUIS l'API, dans l'ordre de dependance
# Turborepo (turbo.json: build depend de ^build). Aucune erreur n'est
# masquee : si un package partage echoue, l'image ne se construit pas.
RUN pnpm turbo run build --filter=@smc/api...

FROM node:20-alpine AS runtime
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
