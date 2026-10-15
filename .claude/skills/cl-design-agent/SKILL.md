---
name: cl-design-agent
description: Design system guidelines for building UI components consistent with packages/ui/ (Base UI primitives, CSS variables, light/dark theme tokens, responsive breakpoints). Use when creating, modifying, or reviewing any visual, component, or responsive-layout work in apps/web/ or packages/ui/ — including new pages, component modifications, layout changes, theme tokens, spacing, typography, **mobile responsiveness, breakpoints, viewport behavior, touch targets**, and design reviews. Trigger when the user says things like "build a component", "style this page", "match the design", "add a button/card/form", "make it look better", **"make this mobile-friendly", "fix the mobile view", "it breaks on small screens", "add a breakpoint", "responsive layout", "stack on mobile"**, or when touching files under packages/ui/src/components/, packages/ui/src/styles/, or any .tsx file that imports from @repo/ui or uses `sm:` / `md:` Tailwind prefixes. Trigger this skill alongside the frontend-design plugin skill for any UI work — they cover different concerns (this one enforces the project's existing tokens, component library, and mobile-adapt-down approach; frontend-design handles aesthetic quality). Even if the task seems small, you must check this skill for any visual, component, or responsive work — using raw colors, one-off breakpoints, or ad-hoc media queries instead of the documented tokens is the most common drift.
---

# Design System

Use this skill alongside `/frontend-design` — frontend-design handles creative implementation, this skill ensures pattern consistency.

## Component Reuse

See `/cl-frontend-patterns` for component directory structure and file organization.

### Priority Order

```
Need UI element?
    ↓
Exists in packages/ui/src/components/?
    ├─ YES → Use with tone/variant/size props
    └─ NO → Exists in shadcn catalog?
              ├─ YES → pnpm ui:add <component>
              └─ NO → Extend existing or create new (rare)
```

### Component Mapping

Before using a component, check if it exists in `packages/ui/src/components/`. If it doesn't, install it with `pnpm ui:add <component>`.

| Need             | Component                    |
| ---------------- | ---------------------------- |
| Clickable action | `Button` — `tone × variant` API. Tones: `primary` \| `secondary` \| `success` \| `destructive` \| `warning`. Variants: `solid` \| `outline` \| `ghost` \| `link`. Both default to primary/solid. |
| Status label     | `Badge` — same `tone × variant` as Button, plus `info` tone. Variants: `solid` \| `outline`. |
| Container        | `Card` (with CardHeader, CardTitle, CardContent, CardFooter) |
| Form fields      | `Input`, `Textarea`, `Label`, `Checkbox` — all support `aria-invalid` for error states |
| Standard modal   | `Dialog` (from `@repo/ui/components/dialog`) |
| Confirmation modal | `AlertDialog` (from `@repo/ui/components/alert-dialog`) — use for destructive confirmations |
| Side panel       | `Sheet`                      |
| Loading spinner  | `Spinner`                    |
| Loading placeholder | `Skeleton`                |
| Notifications    | Sonner (toast)               |
| Visual divider   | `Separator`                  |
| Hover info       | `Tooltip`                    |
| Menu             | `DropdownMenu` — `DropdownMenuItem` supports `variant="destructive"` for dangerous actions |
| Navigation       | `Sidebar` (custom, with collapse/expand) |
| Alert            | `Alert` — variants: `success` \| `destructive` \| `warning` \| `info`. Includes `AlertAction` for inline action buttons (positioned absolute top-right). |

### Creating New Components

Only when existing + shadcn don't cover the need:

1. Use CVA (class-variance-authority) for variant definitions — keeps styling declarative and consistent with existing components
2. Use `cn()` from `@repo/ui/lib/utils` for conditional class merging
3. Use `@base-ui/react` primitives as the base (not raw HTML or Radix directly)
4. Components are plain functions (React 19 style — no `forwardRef`)
5. Place in `packages/ui/src/components/`
6. Follow the `tone` / `variant` / `size` three-axis pattern used by Button and Badge: `tone` for semantic color intent, `variant` for visual treatment (solid/outline/ghost), `size` for dimensions

## Color System

The color system lives in `packages/ui/src/styles/globals.css` with full light/dark theme support. All colors use semantic tokens — no raw brand variables exist.

### Semantic Tokens

| Token | Purpose |
| --- | --- |
| `background` / `foreground` | Page background and default text |
| `card` / `card-foreground` | Card/panel surfaces and text |
| `popover` / `popover-foreground` | Dropdown/popover surfaces and text |
| `primary` / `primary-foreground` | Brand action color (teal) and text on it |
| `secondary` / `secondary-foreground` | Secondary surfaces (header bars, distinct backgrounds) |
| `muted` / `muted-foreground` | Subdued backgrounds and dimmed text |
| `accent` / `accent-foreground` | Subtle hover highlights (translucent) |
| `border` | Default border color |
| `input` | Form input borders |
| `ring` | Focus ring color |

### Semantic State Tokens

All state tokens follow the same pattern: base = soft background surface, `-foreground` = vivid accent color. This is consistent in **both** light and dark modes — no flipping.

| Token pair | Background class | Text class | Use for |
|---|---|---|---|
| `--success` / `--success-foreground` | `bg-success` | `text-success-foreground` | Positive confirmation |
| `--warning` / `--warning-foreground` | `bg-warning` | `text-warning-foreground` | Cautionary states |
| `--info` / `--info-foreground` | `bg-info` | `text-info-foreground` | Neutral information |
| `--destructive` / `--destructive-foreground` | `bg-destructive` | `text-destructive-foreground` | Errors, dangerous actions |

### Usage Priority

Use semantic tokens — they auto-switch between light and dark themes:

1. **`primary` + `secondary` + `muted`** — the workhorses. Use for most UI: buttons, text, surfaces
2. **`accent`** — sparingly, for subtle hover highlights. Never for large background areas (it's translucent by design)
3. **`destructive`** — for destructive actions (delete, remove) AND validation errors (invalid inputs, error messages)

### Background Rules

- Page: `bg-background`
- Cards/panels: `bg-card`
- Subtle section separation: `bg-muted`
- Popovers/dropdowns: `bg-popover`
- Header bars / distinct surfaces: `bg-secondary`

## Forms

### Layout Classes

All form layout uses utility classes from `forms.css`:

| Class | What it does | Use for |
|---|---|---|
| `.form-container` | Vertical flex column with `gap-2` | Wraps Label + Input + help/error text as a single field |
| `.form-row` | Horizontal flex row with `gap-4`, stacks on mobile (<768px) | Side-by-side fields (e.g. first name / last name) |
| `.invalid-input` | Red error text (`text-xs`, `--destructive-foreground`) | Validation error below a field |
| `.help-text` | Muted helper text (`text-xs`, `text-muted-foreground`) | Hint text below a field |
| `.form-actions` | Right-aligned flex row with `gap-2` | Cancel/Submit buttons at the bottom of a form |

### Single Field

```tsx
<div className="form-container">
  <Label htmlFor="email">Email</Label>
  <Input id="email" aria-invalid={hasError} />
  {hasError && <p className="invalid-input">Please enter a valid email.</p>}
  <p className="help-text">We'll never share your email.</p>
</div>
```

### Side-by-Side Fields

```tsx
<div className="form-row">
  <div className="form-container flex-1">
    <Label htmlFor="first">First Name</Label>
    <Input id="first" />
  </div>
  <div className="form-container flex-1">
    <Label htmlFor="last">Last Name</Label>
    <Input id="last" />
  </div>
</div>
```

### Validation

Mark invalid fields with `aria-invalid` — Input, Textarea, and Checkbox all support it and handle error border styling automatically (red border on focus):

```tsx
<Input aria-invalid={hasError} />
<Textarea aria-invalid={hasError} />
<Checkbox aria-invalid={hasError} />
```

### Form Buttons

Use `.form-actions` to right-align action buttons at the bottom of a form:

```tsx
<div className="form-actions">
  <Button tone="secondary" variant="outline">Cancel</Button>
  <Button>Submit</Button>
</div>
```

## Typography

- Default body text: `text-sm` (14px)
- Large/emphasis text: `text-base` (16px)
- Captions/helpers: `text-xs` (12px)
- Section labels / eyebrows: `.section-label` class (uppercase, letter-spaced, muted)
- Headings: h1–h6 defined in `typography.css` with semantic sizes
- Display headings: `.display-title` class for Fraunces serif font (used on landing page hero)

## CSS Files

Styles are split across three files in `packages/ui/src/styles/`:

| File | Contents |
| --- | --- |
| `globals.css` | Theme tokens (`:root` / `.dark`), `@theme inline` Tailwind mappings, base resets, `.section-label`, `.rise-in`, `.page-wrap` |
| `forms.css` | Form layout classes (see Forms section above) |
| `typography.css` | Heading styles (h1–h6), `.display-title` |

## Button Icon Sizes

For icon-only buttons, use dedicated size variants instead of custom sizing:

| Size        | Rendered size | Use for                    |
| ----------- | ------------- | -------------------------- |
| `icon-xs`   | 24px (size-6) | Inline/tight spaces        |
| `icon-sm`   | 32px (size-8) | Secondary actions          |
| `icon`      | 36px (size-9) | Default icon buttons       |
| `icon-lg`   | 40px (size-10)| Primary/prominent actions  |

```tsx
<Button tone="secondary" variant="ghost" size="icon-sm"><TrashIcon /></Button>
```

## Icons

The project uses **Lucide React** (`lucide-react`). Always import icons from this library — don't add other icon packages.

```tsx
import { ChevronDown, Settings, Trash2 } from "lucide-react";
```

- Default icon size is `16px` (`size-4`) for inline/body use, `20px` (`size-5`) for standalone or header contexts
- Inside `<Button size="icon-*">`, the icon inherits size from the button — don't set explicit dimensions
- Use `className="text-muted-foreground"` for decorative/secondary icons, `"text-foreground"` for primary actions

## Spacing

The design system follows Tailwind's 4px grid. Use these consistent values:

| Context | Spacing | Example |
|---------|---------|---------|
| Between form fields | `space-y-4` or `gap-4` | Stacked inputs |
| Card internal padding | `p-6` | `CardContent` default |
| Section separation | `space-y-6` or `gap-6` | Between card sections |
| Inline element gap | `gap-2` | Icon + text, button groups |
| Page sections | `gap-8` or `gap-12` | Between major page blocks |

Stick to the scale: `1`, `1.5`, `2`, `3`, `4`, `5`, `6`, `8`, `12`. Avoid arbitrary spacing values.

## Responsive

The app is mobile-friendly but not mobile-first — desktop layouts adapt down. Mobile is not optional: every new page or component should work on mobile (<768px) by the time it lands. Fixing it after the fact is rework.

**Before finishing any new page/component, check:**

- Multi-column layouts stack (`grid-cols-1 sm:grid-cols-2`, `flex-col sm:flex-row`)
- Long strings (emails, IDs, titles) truncate or wrap — verify at 375px
- Primary nav collapses (`<Sidebar>` does this for free; otherwise use `<Sheet>`)
- Tap targets are usable: prefer `size="lg"` on `<Button>` for primary mobile actions

**Verify responsive behavior:** If the Playwright MCP tools are available (`browser_navigate`, `browser_resize`, `browser_snapshot`), resize to 375px width and take a snapshot to confirm the layout works on mobile before considering the work done.

**Project patterns:**

- Breakpoints: only `sm:` (640px) and `md:` (768px) — no `lg:` / `xl:`
- Width: `.page-wrap` (`min(1080px, calc(100% - 2rem))`)
- Mobile detection in JS: `useIsMobile()` from `@repo/ui/hooks/use-mobile` — use only when CSS alone can't express the change
- Mobile drawers / bottom sheets: `<Sheet>` (e.g. `side="bottom"`)
- Viewport: rely on Next.js defaults, don't override

## Motion

All interactive transitions use `180ms ease` (defined globally for buttons and links). Follow this convention:

| Pattern | Implementation |
|---------|---------------|
| Hover/focus state changes | Already handled by global `180ms ease` transition — don't add custom transitions to buttons/links |
| Entrance animations | Use `.rise-in` with staggered `animationDelay` via inline styles |
| Dropdown/popover open/close | Handled by Base UI primitives (`data-open:fade-in-0`, `data-open:zoom-in-95`) — don't override |

Don't add custom `transition-*` or `animate-*` classes to elements that already have global transitions.

## Toasts

Use Sonner for all notifications — import the `toast` function directly:

```tsx
import { toast } from "sonner";

toast.success("Profile updated!");
toast.error("Failed to save changes.");
```

Toasts are already wired into the app layout via the `<Toaster />` component. Don't add `<Toaster />` again in page components.

## Anti-Patterns

**Wrong — custom button with raw classnames:**
```tsx
<div className="inline-flex items-center rounded-full bg-primary px-4 py-2">
  <span>Click me</span>
</div>
```

**Correct — use Button component:**
```tsx
import { Button } from "@repo/ui/components/button";
<Button>Click me</Button>  {/* tone="primary" variant="solid" are defaults */}
<Button tone="destructive">Delete</Button>
```

**Wrong — hardcoded color values:**
```tsx
<h2 className="text-[#173a40]">Welcome</h2>
<div className="bg-[#f3faf5] border-[#4fb8b2]">...</div>
```

**Correct — use semantic tokens:**
```tsx
<h2 className="text-foreground">Welcome</h2>
<div className="bg-background border-primary">...</div>
```

**Wrong — custom badge/pill with raw classnames:**
```tsx
<span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Active</span>
```

**Correct — use Badge component:**
```tsx
import { Badge } from "@repo/ui/components/badge";
<Badge tone="success">Active</Badge>
<Badge tone="destructive" variant="outline">Expired</Badge>
```

**Wrong — custom alert with raw classnames:**
```tsx
<div className="rounded-md border border-red-500 bg-red-50 p-4">
  <span className="text-sm font-medium">Something went wrong</span>
</div>
```

**Correct — use Alert component:**
```tsx
import { Alert, AlertDescription } from "@repo/ui/components/alert";
<Alert variant="destructive"><AlertDescription>Something went wrong</AlertDescription></Alert>
{/* Other variants: "success" | "warning" | "info" */}
```

## Rules

- **No raw classname components** — never create button/badge-like elements with raw classnames when a component exists.
- **No arbitrary Tailwind values** (`text-[#123456]`, `bg-[#abc]`) — use design tokens.
- **No `rounded-lg` or larger** — all components use `rounded-md`.
- **Default font size is 14px** (`text-sm`) — use `text-base` only for emphasis, `text-xs` only for captions/helpers.
- **Check shadcn first** — always check the shadcn catalog before building custom components.
- **Test both themes** — toggle via the `ThemePicker` component. Verify text contrast, border visibility, and surface layering in both modes.
- **Accent for highlights, not surfaces** — `accent` is translucent and designed for hover states, not large backgrounds.
