# Mobile app (Expo)

The Expo (React Native, SDK 56) app for this monorepo, built with [Expo Router](https://docs.expo.dev/router/introduction). It reuses the shared data/auth layer — `@repo/shared` schemas, `@repo/orpc-contracts`, the oRPC client + TanStack Query, and Clerk — so it talks to the **same Express server** as the web app.

> This is a pnpm + TurboRepo workspace. Run the commands below from the **repo root** with `pnpm`/`turbo` — not `npm install` / `npx expo start`.

## Run it locally

Full setup (including the backend it depends on) lives in
[`docs/setup/LOCAL_ENV.md` → "Run the mobile app (Expo)"](../../docs/setup/LOCAL_ENV.md#run-the-mobile-app-expo--optional).

Quick version, from the repo root:

```bash
pnpm install                                    # if you haven't already
cp apps/mobile/.env.example apps/mobile/.env    # then fill in the two EXPO_PUBLIC_ values

pnpm infra:up && pnpm dev:server                # backend (auth + data) in one terminal
pnpm dev:mobile                                 # Expo dev server in another
```

Then press **`i`** (iOS Simulator) / **`a`** (Android emulator), or scan the QR with [Expo Go](https://expo.dev/go) on a device. On a physical device, set `EXPO_PUBLIC_SERVER_URL` to your machine's LAN IP, not `localhost`.

You need a simulator/emulator or a physical device — `expo start` only runs the dev server. Sign-in and data fetching hit the real server, so the backend must be running.

## Conventions

Read [`CLAUDE.md`](./CLAUDE.md) before writing code here — it documents the project-specific overrides to the Expo template defaults (no `@/` path alias in hand-written code — the CLI-managed UI components under `src/components/ui/` are the only exception, Biome over Expo lint, exact-pinned React/RN versions, the Uniwind + Tailwind v4 styling setup, and the load-bearing `lightningcss` pin). For SDK details, see the versioned docs at <https://docs.expo.dev/versions/v56.0.0/>.

## Common scripts

| Command (from repo root) | Description |
|--------------------------|-------------|
| `pnpm dev:mobile` | Start the Expo dev server (`turbo -F mobile start`) |
| `pnpm -F mobile ios` | Start and open the iOS Simulator |
| `pnpm -F mobile android` | Start and open the Android emulator |
| `pnpm -F mobile check-types` | TypeScript type checking |
| `pnpm biome check --write apps/mobile` | Lint + format (Biome) |
