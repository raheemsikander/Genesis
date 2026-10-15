# Mobile

Expo (React Native, SDK 56) app using Expo Router. Reuses the shared data/auth layer (`@repo/shared`, `@repo/orpc-contracts`, the oRPC + TanStack Query client, Clerk via `@clerk/expo`). Run with `pnpm dev:mobile` (needs a simulator/device + the server running).

> Expo HAS CHANGED. Read the exact versioned docs at <https://docs.expo.dev/versions/v56.0.0/> before writing any code.

## Required skills for this directory

You **must** invoke these skills via the `Skill` tool **before** editing files here. They take priority over generic plugin skills when working in `apps/mobile/`.

**Examples below are illustrative, not exhaustive.** The path rule wins over the example list. Many tasks need more than one skill — invoke all that apply.

| If you're touching… | Invoke skill |
|---|---|
| Any UI component, screen, styling, layout, spacing, typography, theme token, or design tokens in `src/global.css` / `src/tw` / `src/components` | `cl-design-agent` |
| Any form validation, error handling, `ORPCError`, or Zod schema (incl. anything from `@repo/shared`) | `cl-error-handling` |
| Any new or modified env var (note: mobile vars must be `EXPO_PUBLIC_*`) | `cl-adding-environment-variable` |
| Native UI, navigation, routing, animations, data fetching, deployment, or SDK upgrades | the relevant `expo:*` plugin skill (`expo:building-native-ui`, `expo:native-data-fetching`, `expo:expo-tailwind-setup`, `expo:expo-deployment`, `expo:upgrading-expo`, …) |

There is no `cl-frontend-patterns`/`cl-backend-patterns` equivalent for mobile — follow the conventions below plus the `expo:*` skills. Skip invocation only for trivial reads.

## Project conventions (override Expo template defaults)

- **No `@/` path alias.** Repo Biome (`noRestrictedImports`) bans `@/**` — use relative imports within `src/`, and `@repo/*` for workspace packages. The Expo starter ships with `@/` configured; it has been removed from `tsconfig.json` here.
- **Biome, not the Expo lint defaults.** Tab indentation, double quotes. Run `pnpm biome check --write apps/mobile`. CI runs `pnpm biome check .`.
- **React/RN versions are pinned exact** (opted out of the workspace `catalog:`). Add/upgrade Expo + RN packages with `npx expo install <pkg>` so they stay aligned to the SDK. Those package families are listed under `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`.
- **Shared layer:** reuse `@repo/shared` + `@repo/orpc-contracts`; mirror the web oRPC client pattern in `src/utils/orpc.ts`. The auth token comes from `getClerkInstance().session?.getToken()` (the headers callback runs outside React, so no hook).
- **`@repo/ui` is web-only** (Base UI + Tailwind + DOM) — do not import it here. Mobile has its own primitives in `src/components/ui`.
- **Styling: NativeWind v5 + Tailwind v4** via `react-native-css`. Use `className` on the wrapped components exported from `src/tw` (NOT raw `react-native` ones) — the Metro config sets `globalClassNamePolyfill: false`, so `className` only works through `useCssElement`. Design tokens (`bg-background`, `text-foreground`, `text-primary`, ...) are defined in `src/global.css` (`@theme inline` + light/dark CSS vars) and seeded from the web app's `packages/ui` tokens. `global.css` is imported once in `src/app/_layout.tsx`.
  - Required pieces: `nativewind@5.0.0-preview.4` + `react-native-css@^3.0.7` + `@tailwindcss/postcss` + `tailwindcss` v4, `metro.config.js` with `withNativewind`, `postcss.config.mjs`, and a **`lightningcss: 1.30.1` override** in `pnpm-workspace.yaml`.
  - The lightningcss pin is load-bearing: newer 1.31/1.32 produce CSS that `react-native-css` cannot deserialize ("expected an object-like struct named Specifier"). Do not bump it without re-verifying both `expo export` (mobile) and `pnpm -F web build` (web also uses Tailwind v4 → lightningcss). NativeWind is still in preview, so it + `react-native-css` are listed under `minimumReleaseAgeExclude`.
  - No `babel.config.js` is needed (Tailwind v4 is CSS-first). The official setup is the `expo:expo-tailwind-setup` skill (note: its pinned versions target SDK 54; on SDK 56 use the latest nativewind/react-native-css as above to avoid the Metro `addedFiles` error).
