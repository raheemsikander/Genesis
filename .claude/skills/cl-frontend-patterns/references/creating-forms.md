# Creating Forms with TanStack Form

## Overview

Forms in this project use `@tanstack/react-form` with Zod schema validation, connected to the backend via oRPC mutation hooks. The key pattern: **form-level Zod validation via `validators.onChange`**, not per-field manual `safeParse`.

## Quick Reference

| Concern | Pattern |
|---------|---------|
| Form hook | `useForm` from `@tanstack/react-form` |
| Validation | Pass Zod schema to `validators: { onChange: MySchema }` at form level |
| Default values | Provide actual defaults, type-assert: `{ name: "", bio: "" } as MySchema` |
| Field rendering | `<form.Field name="x" children={(field) => ...} />` |
| Field value | `field.state.value` |
| Field change | `field.handleChange(value)` |
| Field blur | `field.handleBlur` |
| Error display | `field.state.meta.errors[0]?.message` (with `?.message`) |
| Error condition | `field.state.meta.isTouched && field.state.meta.errors.length > 0` |
| Submit disabled | `mutation.isPending \|\| !form.state.canSubmit` |
| Form reset | `form.reset()` in the mutation's `onSuccess` |
| API hook location | `src/api/<feature>.api.ts` (dedicated file, not inline) |
| API hook pattern | `useMutation(orpc.<route>.mutationOptions({...}))` |

## Implementation

### 1. Zod Schema (packages/shared)

Define or reuse a schema in `packages/shared/src/models/`:

```ts
import { z } from "zod";

export const UpdateProfileSchema = z.object({
	displayName: z.string().min(1),
	bio: z.string().max(200).optional(),
});

export type UpdateProfileSchema = z.infer<typeof UpdateProfileSchema>;
```

### 2. API Hook (apps/web/src/api/)

Create a dedicated hook file in `src/api/` — never define mutations inline in page components:

```ts
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "../utils/orpc";

export function useUpdateProfile({
	onSuccess,
}: {
	onSuccess: () => void;
}) {
	return useMutation(
		orpc.user.updateProfile.mutationOptions({
			onSuccess: () => {
				onSuccess();
				toast.success("Profile updated!");
			},
		}),
	);
}
```

**Critical:** Use `orpc.<route>.mutationOptions()` — not `orpc.<route>.call()` or raw `mutationFn`.

> **Error handling:** Do NOT add `onError` just for error toasts — the global `MutationCache` already handles it. Only add `onError` for custom side effects (e.g., reset form state). If you do, both the global handler and your hook's `onError` will fire.

### 3. Form Component

```tsx
"use client";

import { UpdateProfileSchema } from "@repo/shared";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Textarea } from "@repo/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useUpdateProfile } from "../../../api/profile.api";

export default function ProfileForm() {
	const mutation = useUpdateProfile({
		onSuccess: () => {
			form.reset();
		},
	});

	const form = useForm({
		defaultValues: {
			displayName: "",
			bio: "",
		} as UpdateProfileSchema,
		validators: {
			onChange: UpdateProfileSchema,
		},
		onSubmit: ({ value }) => {
			mutation.mutate(value);
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4"
		>
			<form.Field
				name="displayName"
				children={(field) => (
					<div className="space-y-2">
						<Label htmlFor="displayName">Display Name</Label>
						<Input
							id="displayName"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
						/>
						{field.state.meta.isTouched &&
							field.state.meta.errors.length > 0 && (
								<p className="text-destructive text-sm">
									{field.state.meta.errors[0]?.message}
								</p>
							)}
					</div>
				)}
			/>

			<form.Field
				name="bio"
				children={(field) => (
					<div className="space-y-2">
						<Label htmlFor="bio">
							Bio <span className="text-muted-foreground">(optional)</span>
						</Label>
						<Textarea
							id="bio"
							value={field.state.value ?? ""}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							maxLength={200}
							rows={3}
						/>
						{field.state.meta.isTouched &&
							field.state.meta.errors.length > 0 && (
								<p className="text-destructive text-sm">
									{field.state.meta.errors[0]?.message}
								</p>
							)}
					</div>
				)}
			/>

			<Button
				type="submit"
				disabled={mutation.isPending || !form.state.canSubmit}
				className="w-full"
			>
				{mutation.isPending ? "Saving..." : "Save Changes"}
			</Button>
		</form>
	);
}
```

## Common Mistakes

| Mistake | Correct |
|---------|---------|
| Per-field `safeParse` validators | Pass Zod schema to `validators: { onChange: Schema }` at form level |
| `orpc.route.call(data)` | `orpc.route.mutationOptions({...})` inside `useMutation()` |
| Inline mutation in page component | Dedicated hook in `src/api/<feature>.api.ts` |
| `@/utils/orpc` alias import | Relative import `../../../utils/orpc` |
| `field.state.meta.errors[0]` | `field.state.meta.errors[0]?.message` |
| `form.Subscribe` for canSubmit | `form.state.canSubmit` directly |
| Missing `e.stopPropagation()` in onSubmit | Always include both `preventDefault` and `stopPropagation` |
| Raw `<input>` / `<button>` elements | Use `Input`, `Button`, `Label` from `@repo/ui` |
| Raw `<textarea>` element | Use `Textarea` from `@repo/ui/components/textarea` — if it doesn't exist yet, add it with `pnpm ui:add textarea` |
| `@tanstack/zod-form-adapter` | Not used — pass Zod schema directly to `validators.onChange` |
| Barrel import `from "@repo/ui"` | Import from subpaths: `@repo/ui/components/button`, `@repo/ui/components/input`, etc. |
