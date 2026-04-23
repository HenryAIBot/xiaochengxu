# syntax=docker/dockerfile:1.7
# Multi-stage build for @xiaochengxu/api. The repo is a pnpm monorepo so we
# copy pnpm-workspace.yaml + root lockfile and filter-install to keep the
# final image lean.

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /repo

# Build stage — compile all workspace packages the API depends on.
FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json biome.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY services/api ./services/api
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @xiaochengxu/api...
RUN pnpm --filter @xiaochengxu/api build

# Runtime stage — only production deps + the compiled output.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/services/api/package.json ./services/api/package.json
COPY --from=build /repo/services/api/dist ./services/api/dist
COPY --from=build /repo/services/api/src/lib/postgres-schema.sql ./services/api/src/lib/postgres-schema.sql
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @xiaochengxu/api...

EXPOSE 3000
CMD ["node", "services/api/dist/server.js"]
