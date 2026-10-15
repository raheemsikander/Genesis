# Environment Variable Inventory

Full per-app inventory of every environment variable in the monorepo, plus the checklist of files to update when adding a new one.

Variables are validated at startup via `src/env.ts` in each app (t3-env + Zod). Never read or write `.env` files directly: always go through the validated `env.ts`.

**Keep this file current.** When a variable is added, renamed, or removed, update the matching list below in the same change. This file (`.claude/skills/cl-adding-environment-variable/references/env-vars.md`) is the canonical inventory.

## Inventory

**Server** (`apps/server/src/utils/env.ts`):

- Required: `DATABASE_URL`, `CORS_ORIGIN` (comma-separated list of full browser origin URLs, e.g. `http://localhost:3001` or `https://app.example.com,https://admin.example.com`), `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`
- Optional: `PORT` (defaults to `3000`), `REDIS_URL` (BullMQ worker connection), `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (email service), `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT` (public URL clients use to reach storage; presigned GET URLs are signed against this host: set to your LAN MinIO URL when testing from a phone or any client not on the server host; defaults to `S3_ENDPOINT`), `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (S3-compatible storage), `S3_REGION` (defaults to `"us-east-1"`), `S3_BUCKET` (defaults to `"file-uploads"`), `DB_POOL_MAX` (PostgreSQL connection pool size, defaults to `20`), `NODE_ENV` (defaults to `"development"`), `LOG_LEVEL` (defaults to `"info"`), `ROLLBAR_SERVER_TOKEN` (error tracking)

`CORS_ORIGIN` accepts a comma-separated list of full browser origin URLs (each must include the scheme, e.g. `http://localhost:3001`). Use multiple entries for forks that need a staging origin plus a preview URL. Each entry is validated as a URL at startup; bare hostnames or `*` will fail. The first entry is treated as the primary app URL and is used in transactional email links.

`S3_PUBLIC_ENDPOINT` is the host presigned GET URLs are signed against. AWS SigV4 covers the host header, so the signing endpoint and the access endpoint must match: point this at a LAN-reachable MinIO URL whenever the client is not on the server's host.

**Web** (`apps/web/src/utils/env.ts`), all prefixed with `NEXT_PUBLIC_`:

- Required: `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- Optional: `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN`, `NEXT_PUBLIC_MIXPANEL_TOKEN` (Mixpanel product analytics + session replay; leave unset to disable), `NEXT_PUBLIC_NODE_ENV` (defaults to `"development"`)

**Mobile** (`apps/mobile/src/utils/env.ts`), all prefixed with `EXPO_PUBLIC_` (Expo inlines these into the bundle at build time):

- Required: `EXPO_PUBLIC_SERVER_URL` (use a LAN IP on a physical device, not `localhost`), `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` (same value as the web app's)
- Optional: `EXPO_PUBLIC_NODE_ENV` (defaults to `"development"`)

## Adding a variable

When adding a new environment variable, update ALL applicable locations.

### Server-side variables

1. `apps/server/src/utils/env.ts`: add to the t3-env schema (required or optional)
2. `apps/server/.env.example`: add example value for other developers
3. This file: keep the server list above current

### Client-side variables (prefixed with `NEXT_PUBLIC_`)

1. `apps/web/src/utils/env.ts`: add to the t3-env schema (required or optional)
2. `apps/web/.env.example`: add example value for other developers
3. This file: keep the web list above current

### Mobile variables (prefixed with `EXPO_PUBLIC_`)

1. `apps/mobile/src/utils/env.ts`: add to the `@t3-oss/env-core` schema (`client` + `runtimeEnv`)
2. `apps/mobile/.env.example`: add example value for other developers
3. This file: keep the mobile list above current
