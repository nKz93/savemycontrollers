# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/worker/package.json ./apps/worker/package.json
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
RUN pnpm turbo run build --filter=@smc/worker...

FROM node:20-alpine AS runtime
# Meme correctif que infra/docker/api/Dockerfile : openssl requis pour
# que Prisma detecte correctement libssl sur Alpine (musl), sinon
# tentative d'ecriture dans node_modules refusee par l'utilisateur
# non-root.
RUN apk add --no-cache openssl
RUN corepack enable && addgroup -S smc && adduser -S smc -G smc
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=smc:smc /repo/apps/worker/dist ./dist
COPY --from=build --chown=smc:smc /repo/apps/worker/package.json ./package.json
COPY --from=build --chown=smc:smc /repo/node_modules ./node_modules
COPY --from=build --chown=smc:smc /repo/packages ./packages
USER smc
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
