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

# VITE_ vars are baked in at build time
ARG VITE_API_URL=http://localhost:3002
ENV VITE_API_URL=${VITE_API_URL}

RUN --mount=type=cache,id=pnpm-web,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@gitvisor/web...
RUN pnpm deploy --filter=@gitvisor/web --prod /deploy

FROM base AS runner
WORKDIR /app

COPY --from=build /deploy .

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server-start.mjs"]
