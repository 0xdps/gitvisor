FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY cloud-packages/ cloud-packages/
COPY cloud-apps/ cloud-apps/
COPY core/packages/ core/packages/
COPY core/apps/web/ core/apps/web/
COPY core/tsconfig.base.json core/tsconfig.base.json

RUN --mount=type=cache,id=pnpm-web,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@gitvisor/web...
RUN pnpm deploy --filter=@gitvisor/web --prod /deploy

FROM base AS runner
WORKDIR /app

COPY --from=build /deploy .
# Copy the Next.js standalone output if using output: 'standalone'
# Otherwise node_modules/.bin/next start is used below.

ENV NODE_ENV=production
EXPOSE 3000
# API_INTERNAL_URL is injected at runtime via docker-compose (not baked in at build time)
CMD ["node_modules/.bin/next", "start"]

# ── Dev Stage (Next.js HMR via next dev) ─────────────────────────────────────
# Used by docker-compose.override.yml. Source dirs are volume-mounted at runtime.
FROM base AS dev
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml turbo.json ./
COPY cloud-packages/ cloud-packages/
COPY cloud-apps/ cloud-apps/
COPY core/packages/ core/packages/
COPY core/apps/web/ core/apps/web/
COPY core/tsconfig.base.json core/tsconfig.base.json

RUN --mount=type=cache,id=pnpm-web,target=/pnpm/store pnpm install --frozen-lockfile

WORKDIR /app/core/apps/web
ENV NODE_ENV=development
EXPOSE 3000
CMD ["node_modules/.bin/next", "dev"]
