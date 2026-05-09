FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/ packages/
COPY apps/worker/ apps/worker/
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@gitvisor/worker...

FROM base AS runner
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
COPY --from=build /app/packages/*/dist ./packages/
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]
