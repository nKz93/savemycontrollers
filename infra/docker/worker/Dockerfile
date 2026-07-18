# syntax=docker/dockerfile:1
# Meme remarque que infra/docker/api/Dockerfile concernant le blocage
# Prisma dans cet environnement de generation.

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
RUN pnpm turbo run build --filter=@smc/worker...

FROM node:20-alpine AS runtime
RUN corepack enable && addgroup -S smc && adduser -S smc -G smc
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/worker/dist ./dist
COPY --from=build /repo/apps/worker/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
USER smc
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
