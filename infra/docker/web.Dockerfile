FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/web/ apps/web/
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@gitvisor/web...

FROM base AS runner
WORKDIR /app
COPY --from=build /app/apps/web/.output ./.output
ENV NODE_ENV=production
CMD ["node", ".output/server/index.mjs"]
