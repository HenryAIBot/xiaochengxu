# syntax=docker/dockerfile:1.7
# Multi-stage build for @xiaochengxu/jobs (BullMQ worker).

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json biome.json ./
COPY scripts ./scripts
COPY packages ./packages
COPY services/jobs ./services/jobs
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @xiaochengxu/jobs...
RUN pnpm --filter @xiaochengxu/jobs build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/package.json /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml ./
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/services/jobs/package.json ./services/jobs/package.json
COPY --from=build /repo/services/jobs/dist ./services/jobs/dist
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @xiaochengxu/jobs...

CMD ["node", "services/jobs/dist/worker.js"]
