FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Build ─────────────────────────────────────────────────────────────────────
# Builds all three core services in one stage.
# Cloud workspace packages are included as package.json stubs only — pnpm
# requires every workspace directory to exist during --frozen-lockfile install.
FROM base AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./

# Cloud stubs (package.json only — no source needed)
COPY cloud-packages/billing/package.json           cloud-packages/billing/
COPY cloud-packages/db-mesahub/package.json        cloud-packages/db-mesahub/
COPY cloud-packages/queue-cloudflare/package.json  cloud-packages/queue-cloudflare/
COPY cloud-apps/api/package.json                   cloud-apps/api/
COPY cloud-apps/worker/package.json                cloud-apps/worker/
COPY cloud-apps/web/package.json                   cloud-apps/web/

# Core source
COPY core/tsconfig.base.json  core/tsconfig.base.json
COPY core/packages/           core/packages/
COPY core/apps/api/           core/apps/api/
COPY core/apps/web/           core/apps/web/
COPY core/apps/worker/        core/apps/worker/

RUN --mount=type=cache,id=pnpm-core-all,target=/pnpm/store pnpm install --frozen-lockfile

# Build all three apps (turbo resolves dependency order automatically)
RUN pnpm turbo run build \
      --filter=@gitvisor/api... \
      --filter=@gitvisor/web... \
      --filter=@gitvisor/worker...

# Deploy each app to an isolated directory that carries its own node_modules
RUN pnpm deploy --filter=@gitvisor/api    --prod /services/api
RUN pnpm deploy --filter=@gitvisor/web    --prod /services/web
RUN pnpm deploy --filter=@gitvisor/worker --prod /services/worker

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

COPY --from=build /services/api    api/
COPY --from=build /services/web    web/
COPY --from=build /services/worker worker/

# Process supervisor — starts api, web, and worker as child processes
COPY core/infra/docker/start.mjs start.mjs

ENV NODE_ENV=production
# In a single-container deployment the API is reachable on localhost
ENV API_INTERNAL_URL=http://localhost:3002

EXPOSE 3000 3002
CMD ["node", "start.mjs"]
