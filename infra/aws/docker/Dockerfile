# syntax=docker/dockerfile:1
#
# AWS-only images, built from the repo root:
#   docker build -f infra/aws/docker/Dockerfile --target web .
#   docker build -f infra/aws/docker/Dockerfile --target migrate .
# The API image is the root Dockerfile, unchanged.

# =============================================================================
# deps: the whole workspace (minus apps/mobile, see .dockerignore) installed once.
# =============================================================================
FROM node:24-alpine AS deps

ENV PNPM_HOME="/pnpm" \
	PATH="/pnpm:$PATH" \
	COREPACK_ENABLE_DOWNLOAD_PROMPT=0

RUN corepack enable

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY patches ./patches
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/orpc-contracts/package.json ./packages/orpc-contracts/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN pnpm install --frozen-lockfile

COPY . .

# =============================================================================
# migrate: one-off ECS task that runs Drizzle migrations from inside the VPC.
# DATABASE_URL is injected by ECS; CI=true skips t3-env validation of the
# server vars the migration doesn't need.
# =============================================================================
FROM deps AS migrate

ENV CI=true

CMD ["pnpm", "--filter", "server", "db:migrate"]

# =============================================================================
# web-builder: Next.js standalone build. NEXT_PUBLIC_* values are inlined at
# build time, so the image is built per environment.
# =============================================================================
FROM deps AS web-builder

ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ARG NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ARG NEXT_PUBLIC_NODE_ENV
ARG NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN
ARG NEXT_PUBLIC_MIXPANEL_TOKEN
ARG NEXT_PUBLIC_GA4_MEASUREMENT_ID
ARG DEPLOY_URL
ARG GIT_COMMIT_SHA

ENV NEXT_OUTPUT=standalone \
	NEXT_TELEMETRY_DISABLED=1 \
	NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL \
	NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
	NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL \
	NEXT_PUBLIC_CLERK_SIGN_UP_URL=$NEXT_PUBLIC_CLERK_SIGN_UP_URL \
	NEXT_PUBLIC_NODE_ENV=$NEXT_PUBLIC_NODE_ENV \
	NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN=$NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN \
	NEXT_PUBLIC_MIXPANEL_TOKEN=$NEXT_PUBLIC_MIXPANEL_TOKEN \
	NEXT_PUBLIC_GA4_MEASUREMENT_ID=$NEXT_PUBLIC_GA4_MEASUREMENT_ID \
	DEPLOY_URL=$DEPLOY_URL \
	GIT_COMMIT_SHA=$GIT_COMMIT_SHA

# The Rollbar source-map token is a build secret, never a layer; when absent
# the script skips the upload.
RUN --mount=type=secret,id=rollbar_sourcemap_token,env=ROLLBAR_CLIENT_SOURCEMAP_TOKEN \
	pnpm --filter web exec bash scripts/build-with-sourcemaps.sh

# =============================================================================
# web: minimal runtime holding only the standalone server + static assets.
# =============================================================================
FROM node:24-alpine AS web

WORKDIR /app

ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0

COPY --from=web-builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=web-builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static

USER node

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
