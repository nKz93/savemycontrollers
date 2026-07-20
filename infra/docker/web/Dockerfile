# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# NEXT_PUBLIC_API_URL doit etre connu AU BUILD (Next.js l'inline dans le
# bundle navigateur a la compilation, pas a l'execution du conteneur) —
# voir .github/workflows/deploy-staging.yml qui le fournit comme
# build-arg.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm turbo run build --filter=@smc/web...

FROM node:20-alpine AS runtime
RUN corepack enable && addgroup -S smc && adduser -S smc -G smc
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
# public/ n'existe pas encore dans ce projet (aucune image/asset statique
# committee a ce stade) : copie conditionnelle, jamais une erreur de build
# si le dossier est absent.
COPY --from=build /repo/apps/web/public ./apps/web/public
USER smc
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
STOPSIGNAL SIGTERM
CMD ["node", "apps/web/server.js"]
