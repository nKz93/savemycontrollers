# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages ./packages
COPY apps/ops/package.json ./apps/ops/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm turbo run build --filter=@smc/ops...

FROM node:20-alpine AS runtime
RUN corepack enable && addgroup -S smc && adduser -S smc -G smc
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /repo/apps/ops/.next/standalone ./
COPY --from=build /repo/apps/ops/.next/static ./apps/ops/.next/static
COPY --from=build /repo/apps/ops/public ./apps/ops/public
USER smc
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
STOPSIGNAL SIGTERM
CMD ["node", "apps/ops/server.js"]
