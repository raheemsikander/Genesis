# UI Package

Component library built on `@base-ui/react` primitives with a custom design system (CSS variables, light/dark theme tokens). Components are added via `pnpm ui:add <component>` (shadcn CLI). Consumed across the monorepo via `@repo/ui`.

## Required skills for this directory

You **must** invoke these skills via the `Skill` tool **before** editing files here. They take priority over generic plugin skills (e.g. `frontend-ui-engineering`, `frontend-design`) when working in `packages/ui/`.

| If you're touching… | Invoke skill |
|---|---|
| Any component in `src/components/`, `src/styles/`, or anything exporting from `@repo/ui` | `cl-design-agent` |
| Components consumed by `apps/web/` pages (the typical case) | `cl-design-agent` + `cl-frontend-patterns` |

Before adding a raw color, hex value, or one-off style — check the existing CSS variables in `src/styles/`. Drift from design tokens is the most common quality issue here.
