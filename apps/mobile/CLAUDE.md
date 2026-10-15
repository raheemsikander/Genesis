# Mobile

Expo (React Native, SDK 56) app using Expo Router. Reuses the shared data/auth layer (`@repo/shared`, `@repo/orpc-contracts`, the oRPC + TanStack Query client, Clerk via `@clerk/expo`). Run with `pnpm dev:mobile` (needs a simulator/device + the server running).

**Targets iOS and Android ONLY; there is no web target.** Web is served by `apps/web` (Next.js). Do not add `react-native-web`, an `expo start --web` script, or an `app.json` `web` block; do not write `.web.tsx` files or web fallbacks. Platform-specific code needs at most an `.ios` and an `.android` variant (components: a pair plus a `*-types.ts` contract; hooks/utils: a base file with an `.ios` override). `tsconfig.json` sets `moduleSuffixes: [".ios", ".android", ""]`, so `.ios`/`.android` pairs without a base file typecheck fine. Exception: `react-dom` stays in dependencies pinned exactly equal to `react`. Transitive deps (Clerk) import it at runtime on native, and React throws at startup on any version mismatch; it does not imply a web target.

> Expo HAS CHANGED. Read the exact versioned docs at <https://docs.expo.dev/versions/v56.0.0/> before writing any code.

## Required skills for this directory

You **must** invoke these skills via the `Skill` tool **before** editing files here. They take priority over generic plugin skills when working in `apps/mobile/`.

**Examples below are illustrative, not exhaustive.** The path rule wins over the example list. Many tasks need more than one skill — invoke all that apply.

| If you're touching… | Invoke skill |
|---|---|
| Any UI component, screen, styling, layout, spacing, typography, or design tokens in `src/global.css` / `src/components` | `cl-design-agent` |
| Any form validation, error handling, `ORPCError`, or Zod schema (incl. anything from `@repo/shared`) | `cl-error-handling` |
| Any new or modified env var (note: mobile vars must be `EXPO_PUBLIC_*`) | `cl-adding-environment-variable` |
| Native UI, navigation, routing, animations, data fetching, deployment, or SDK upgrades | the relevant `expo:*` plugin skill (`expo:building-native-ui`, `expo:native-data-fetching`, `expo:expo-deployment`, `expo:upgrading-expo`, …) |

There is no `cl-frontend-patterns`/`cl-backend-patterns` equivalent for mobile — follow the conventions below plus the `expo:*` skills. Skip invocation only for trivial reads.

## Architecture

```
src/
├── app/                    # Expo Router file-based routes
│   ├── _layout.tsx         # Root layout: providers (Clerk, Query), global.css import
│   ├── index.tsx           # Public entry — redirects based on auth state
│   ├── (auth)/             # Public auth screens (sign-in, sign-up, reset, verify, SSO)
│   └── (portal)/           # Protected screens (requires Clerk session)
│       ├── _layout.tsx     # Auth guard + themed native stack (detail screens)
│       └── (tabs)/         # NativeTabs bar (liquid glass on iOS 26+, Material 3 on Android)
│           ├── _layout.tsx # NativeTabs triggers (SF Symbol + Material Symbol icons)
│           └── (home)/ (users)/ (storage)/ (more)/   # One Stack per tab (native large-title headers)
├── components/
│   ├── ui/                 # react-native-reusables components (CLI-managed, owned code)
│   ├── safe-area-view.tsx  # withUniwind-adapted SafeAreaView
│   └── *.tsx               # Hand-written feature components
├── utils/
│   ├── env.ts              # Validated EXPO_PUBLIC_* env (t3-env) — never read process.env directly
│   ├── orpc.ts             # oRPC client + TanStack Query setup (mirrors web)
│   └── cn.ts               # clsx + tailwind-merge
├── global.css              # Tailwind v4 entry + design tokens (@variant light/dark)
└── uniwind-types.d.ts      # Metro-generated className typings (committed)
```

- **Data layer:** contract-first oRPC. Schemas in `@repo/shared` → contracts in `@repo/orpc-contracts` → typed client in `src/utils/orpc.ts` consumed via TanStack Query hooks. Identical flow to web.
- **Auth:** Clerk (`@clerk/expo`), token persisted in `expo-secure-store`. The oRPC headers callback gets the JWT via `getClerkInstance().session?.getToken()` (runs outside React — no hook).
- **Styling:** Uniwind + Tailwind v4. `className` works directly on `react-native` core components. Third-party components need the `withUniwind` adapter (see `src/components/safe-area-view.tsx`). Design tokens live in `src/global.css` (`@layer theme` + `@variant light`/`@variant dark`), seeded from the web `packages/ui` tokens; the theme follows the system color scheme.
- **Components:** `src/components/ui/` is owned code re-exported from the barrel `index.ts`. Interactive controls (Button, Switch) are native platform widgets via `@expo/ui` (see "Component usage rules"); presentation components (Text, Card, Badge, Separator, Label, Input) come from react-native-reusables (uniwind registry), the shadcn/ui equivalent for React Native. `@repo/ui` is web-only; never import it here.
- **Build pipeline:** `metro.config.js` wrapped with `withUniwindConfig` (`cssEntryFile`, `dtsFile`). No Babel plugin, no PostCSS config, no native styling module — Expo Go works.

## Native UI strategy (decision record)

For navigation chrome, **native feel wins over brand styling**; for screen content, the shared design system wins. We deliberately do NOT build whole screens with `@expo/ui` (SwiftUI/Jetpack Compose) while it is alpha: it would mean two platform-specific UI trees and losing the token-based design system shared with web. Adoption is tiered:

- **Tier 1 (adopted):** `NativeTabs` from `expo-router/unstable-native-tabs` (liquid glass tab bar on iOS 26+, Material 3 bottom nav on Android) + native stack headers (transparent large-title with system blur on iOS, token-tinted opaque headers elsewhere). One cross-platform API, no `@expo/ui` dependency on our side.
- **Tier 2 (adopted):** selective `@expo/ui` for platform-feeling surfaces and interactive controls, behind our own wrapper components with platform extensions. Adopted so far: the More screen (`src/components/more-list.ios.tsx` is a SwiftUI `Form`; `more-list.android.tsx` is the Android fallback) and the ui-kit controls (`Button` = SwiftUI / Compose M3, `Switch` = UISwitch / Compose M3; see "Component usage rules"). Follow that pattern for new Tier 2 surfaces: one component name, `.ios`/`.android` extensions, callers stay platform-agnostic. Every SwiftUI tree must be wrapped in `Host` (`matchContents` for inline controls, `useViewportSizeMeasurement` for filling views like `Form`). `@expo/ui` is already a direct dependency (SDK-pinned, works in Expo Go).
- **Tier 3 (avoid for now):** full `@expo/ui` screens. Revisit when `@expo/ui` is stable.

### Working with the native chrome

- **Tabs:** triggers live in `(tabs)/_layout.tsx`. The `name` must match the tab's group folder exactly, parens included (`name="(home)"`). Icons use `sf` (SF Symbols, iOS) + `md` (Material Symbols, Android), never `@expo/vector-icons` here. Android allows max 5 tabs; tabs must be static (no runtime add/remove).
- **Headers:** `NativeTabs` render no headers. Each tab group has its own `Stack` whose options come from `useNativeHeaderOptions()` (`src/hooks/use-native-header-options.ts`, iOS variant in `use-native-header-options.ios.ts`). Tab roots use `{ largeTitle: true }` (transparent large-title on iOS); the portal stack (detail screens) uses the opaque token-tinted variant. Header and tab-tint colors are raw values sourced from `src/theme/native-tokens.ts` (the single mirror of `src/global.css` tokens for native chrome, which can't read `className`); update that file and `src/global.css` together when tokens change.
- **Tab screens must have a ScrollView/FlatList as the first child** with `contentInsetAdjustmentBehavior="automatic"`, or content will sit under the transparent iOS header (put non-scrolling chrome in `ListHeaderComponent`, as the storage screen does).
- **Liquid glass only renders on iOS 26+.** On older iOS you get a plain (correct) native tab bar; that's not a bug.

## Extending the app

### Add a screen

1. Create the route file under `src/app/(portal)/` (protected) or `src/app/(auth)/` (public) — Expo Router maps files to routes.
2. A new tab needs its own group folder `src/app/(portal)/(tabs)/(<name>)/` containing a `Stack` `_layout.tsx` (copy an existing one) plus the screen file, and a matching `<NativeTabs.Trigger name="(<name>)">` in the tab `_layout.tsx`. Screens pushed within a tab go in that tab's group folder.
3. Build the UI from the `src/components/ui` barrel; screen scaffold: `<ScrollView className="flex-1 bg-background" contentInsetAdjustmentBehavior="automatic">` with a `<View className="gap-4 p-5">` content wrapper.

### Add a UI component

From the **repo root** (mirrors the web `pnpm ui:add <component>`):

```bash
pnpm ui:add:mobile <component>     # e.g. pnpm ui:add:mobile dialog
```

The CLI installs any `@rn-primitives/*` deps and writes the component to `src/components/ui/`. Then:

1. Re-export it from `src/components/ui/index.ts`.
2. If it uses tokens missing from `src/global.css`, add them to **both** `@variant light` and `@variant dark` blocks, seeding values from `packages/ui/src/styles/globals.css`.
3. Catalog: <https://reactnativereusables.com/docs/components>.

Local edits to the owned files are fine (shadcn philosophy) — keep them small and commented (existing examples: the Button `loading` prop, destructive text token).

### Call the backend

Add the procedure server-side first (see `cl-backend-patterns`), then consume it through the typed client: `orpc.<router>.<procedure>` with TanStack Query (`useQuery`/`useMutation`). Never `fetch` the server directly.

### Add an env var

Follow `cl-adding-environment-variable`: `src/utils/env.ts` schema + `.env.example` + root CLAUDE.md list. Must be `EXPO_PUBLIC_*` (inlined at build time). Use a LAN IP for `EXPO_PUBLIC_SERVER_URL` on physical devices.

## Component usage rules

**Interactive controls are native; static presentation is token-styled RN.** Controls (Button, Switch, future pickers/sliders/checkboxes) are real platform widgets (SwiftUI on iOS, Material 3 Compose on Android) via `@expo/ui`, behind platform-extension pairs in `src/components/ui/`. Presentation components (`Text`, `Card`, `Badge`, `Separator`, `Label`) stay RN + Uniwind tokens: there is no platform widget for them, and wrapping every text in a SwiftUI `Host` would wreck layout and performance. `Input` stays RN `TextInput`, which already renders the native UITextField/EditText, and SwiftUI `TextField` is uncontrolled (breaks TanStack Form resets); reserve SwiftUI `TextField` for screens that are entire SwiftUI `Form`s.

- Import from the barrel: `import { Button, Card, Text } from "../../components/ui";`
- **`Button` is label-based, never give it `<Text>` children** (native buttons take a string):
  ```tsx
  <Button label="Delete" variant="destructive" loading={isPending} onPress={...} />
  ```
  API: `label`, `variant` = `default | secondary | outline | ghost | link | destructive`, `size` = `sm | default | lg`, `loading` (native spinner + disabled), `disabled`, `className` (layout-only classes on the RN wrapper View). iOS maps variants to `buttonStyle` (`borderedProminent`/`bordered`/`borderless`) with the destructive role; Android maps to the M3 family (`Button`/`FilledTonalButton`/`OutlinedButton`/`TextButton`) with destructive tokens.
- `Switch` keeps the `checked`/`onCheckedChange`/`disabled` API: UISwitch on iOS (RN core `Switch`, no Host), Compose M3 switch on Android.
- **Always use the ui `Text`, not react-native's**, since it carries theme tokens (dark mode) and receives contextual styling inside `Badge`/`Card`.
- `Card`: shadcn-style with `CardHeader`/`CardContent`/etc.; simple cards use `<Card className="gap-3 p-5">` with direct children.
- `Input` invalid state: `className="border-destructive"` (no `invalid` prop). It ships native-feel defaults (iOS clear button while editing, primary-tinted caret/selection); override per call site if needed.
- The rnr-owned files in `src/components/ui/` have had their `Platform.select({ web: ... })` branches stripped (no web target). When adding a new component via `pnpm ui:add:mobile`, strip any web branches it brings along.
- `Spinner` wraps the native `ActivityIndicator`; `TextLink` is a hand-written local.
- Native control colors (button tint, destructive) are sourced from `src/theme/native-tokens.ts`, which is the single mirror of `src/global.css` tokens for any native API that can't read `className`. Update that file and `src/global.css` together when tokens change.

## Project conventions (override Expo template defaults)

- **Platform-specific code uses Expo platform extensions**, not runtime branches (`process.env.EXPO_OS` / `Platform.OS`). The rule differs by file type:
  - **Components** always use a **pair** (`component-name.ios.tsx` + `component-name.android.tsx`, no base file). If the component takes props, include a **`component-name-types.ts` contract file** that both platform files import their props type from, ensuring both are type-checked against one contract even though `moduleSuffixes: [".ios", ".android", ""]` means `tsc` only resolves imports to the `.ios` file. Prop-less pairs (e.g., `more-list.ios.tsx` / `more-list.android.tsx`) need no contract file. Canonical examples: `src/components/ui/button-types.ts` / `button.ios.tsx` / `button.android.tsx` and `switch-types.ts` / `switch.ios.tsx` / `switch.android.tsx`.
  - **Hooks and utilities** that have one genuinely cross-platform implementation may use a base file + a `.ios` override (the base serves Android and any future platform). Examples: `src/hooks/use-native-header-options{,.ios}.ts`, `src/hooks/use-tab-tint-color{,.ios}.ts`.
- **No `@/` path alias in hand-written code.** Repo Biome (`noRestrictedImports`) bans `@/**` — use relative imports within `src/`, and `@repo/*` for workspace packages. Exception: CLI-written files in `src/components/ui/` use `@/*` (configured in `tsconfig.json` for the rnr CLI); the root `biome.json` disables only `noRestrictedImports` for that directory so the formatter, assist, and all other lint rules still apply.
- **Biome, not the Expo lint defaults.** Tab indentation, double quotes. Run `pnpm biome check --write apps/mobile`. CI runs `pnpm biome check .`.
- **React/RN versions are pinned exact** (opted out of the workspace `catalog:`). Add/upgrade Expo + RN packages with `npx expo install <pkg>` so they stay aligned to the SDK. Expo/Meta first-party scopes (`expo`, `expo-*`, `@expo/*`, `@react-native/*`, `metro-*`) are excluded from the 7-day release-age gate as globs; community `react-native-*` packages are listed explicitly in `minimumReleaseAgeExclude` so new ones go through the gate by default.
- **`src/uniwind-types.d.ts` is generated** by Metro from `global.css` and committed so `tsc` passes without a Metro run. Regenerate by running any bundle/export after changing themes. It and `expo-env.d.ts` are fully excluded from Biome (linter, formatter, and assist).
- **`lightningcss: 1.30.1` override** in `pnpm-workspace.yaml` is shared with the web build; uniwind pins the same version internally. Re-verify both `pnpm -F web build` and `expo export` before any bump.
