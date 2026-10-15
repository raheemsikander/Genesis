# =============================================================================
# Stage 1: builder
# Installs all dependencies, compiles the server, then uses `pnpm deploy` to
# create an isolated production package with only runtime dependencies.
# Internal @repo/* packages are bundled into the output by tsdown
# (noExternal: [/@repo\/.*/]) so they do not need to be in the runner image.
# =============================================================================
FROM node:24-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Copy dependency manifests first so pnpm install is cached across code changes
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/orpc-contracts/package.json ./packages/orpc-contracts/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

# Copy source code (this layer changes on every code change, but install is cached)
COPY . .

RUN pnpm --filter server build

# Deploy server with production dependencies only into an isolated directory.
# --legacy bypasses the inject-workspace-packages requirement.
RUN pnpm --filter server --prod deploy --legacy /prod/server

# =============================================================================
# Stage 2: runner
# Minimal production image. Copies only:
#   - /prod/server/node_modules (production deps only, no devDependencies)
#   - apps/server/dist (compiled output — @repo/* packages are bundled in)
# No source code, no dev dependencies, no other workspace packages.
# =============================================================================
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy isolated production dependencies from pnpm deploy
COPY --from=builder /prod/server/node_modules ./node_modules

# Copy compiled server output
COPY --from=builder /app/apps/server/dist ./apps/server/dist

# Render injects PORT automatically for web services.
# The server reads PORT via env.ts and falls back to 3000 for local dev.
EXPOSE 3000

CMD ["node", "apps/server/dist/index.mjs"]
