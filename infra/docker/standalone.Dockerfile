FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ── Build ─────────────────────────────────────────────────────────────────────
# Standalone build for the self-hosted OSS release.
# Built directly from the gitvisor core repo (no monorepo root context needed).
FROM base AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY packages/ packages/
COPY apps/api/    apps/api/
COPY apps/web/    apps/web/
COPY apps/worker/ apps/worker/

RUN --mount=type=cache,id=pnpm-standalone,target=/pnpm/store pnpm install --frozen-lockfile

RUN pnpm turbo run build \
      --filter=@gitvisor/api... \
      --filter=@gitvisor/web... \
      --filter=@gitvisor/worker...

RUN pnpm deploy --filter=@gitvisor/api    --prod /services/api
RUN pnpm deploy --filter=@gitvisor/web    --prod /services/web
RUN pnpm deploy --filter=@gitvisor/worker --prod /services/worker

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

COPY --from=build /services/api    api/
COPY --from=build /services/web    web/
COPY --from=build /services/worker worker/

COPY infra/docker/start.mjs start.mjs

ENV NODE_ENV=production
# API is on loopback in single-container deployments
ENV API_INTERNAL_URL=http://localhost:3002

EXPOSE 3000 3002
CMD ["node", "start.mjs"]
