---
name: cl-adding-email-template
description: Use when adding or modifying an email template in apps/server/src/email/ — welcome emails, password reset, invites, notifications, or any transactional email sent via Resend. Trigger when the user says things like "send a new email", "add a welcome email", "set up password reset email", "create email template", or when touching files in apps/server/src/email/templates/, packages/shared/src/models/email*, or anything importing from @repo/shared email schemas. You must invoke this skill before adding any new email — there are required steps in shared schemas, server handler, and template registration that are easy to miss.
---

# Adding an Email Template

## Overview

Email templates are React components rendered to HTML via `@react-email/components` and sent through Resend. The system is fully type-safe: template data schemas, subject lines, and component props are all derived from a single `EmailTemplates` registry.

## Files to Touch

| Step | File | What to do |
|------|------|------------|
| 1 | `packages/shared/src/models/email.types.ts` | Add input/output Zod schemas (API request/response shapes) |
| 2 | `packages/shared/src/models/email-template.types.ts` | Register template placeholders schema + subject fn in `EmailTemplates` |
| 3 | `packages/shared/src/index.ts` | Export new schemas (if not already re-exported via wildcard) |
| 4 | `apps/server/src/email/templates/<name>.template.tsx` | Create React email component |
| 5 | `apps/server/src/email/templates/index.ts` | Add component to `templateMap` |
| 6 | `packages/orpc-contracts/src/contracts/email.contract.ts` | Add contract method |
| 7 | `apps/server/src/controllers/email/email.service.ts` | Add service function |
| 8 | `apps/server/src/controllers/email/email.controller.ts` | Add controller handler |
| 9 | `apps/web/src/api/email.api.ts` | Add frontend mutation hook if needed |

## Step-by-Step

### 1. Define API Schemas (`packages/shared/src/models/email.types.ts`)

These schemas define the **API request/response shapes** — what the frontend sends and what it gets back. They are separate from the template's placeholders (step 2).

For example, the API input might accept `to` + `userName`, but the template also needs a `dashboardUrl` that the service constructs server-side. The API schema only includes what the caller provides; the template schema includes everything the email needs to render.

Naming: `<Action><Entity><Input|Result>Schema` in `.types.ts` files. Both the `const` and `type` share the same name.

```typescript
// API schema — what the frontend sends
export const WelcomeEmailInputSchema = z.object({
  to: z.email(),
  userName: z.string(),
});
export type WelcomeEmailInputSchema = z.infer<typeof WelcomeEmailInputSchema>;

export const WelcomeEmailSendResultSchema = z.object({
  id: z.string(),
});
export type WelcomeEmailSendResultSchema = z.infer<typeof WelcomeEmailSendResultSchema>;
```

### 2. Register Template Placeholders (`packages/shared/src/models/email-template.types.ts`)

This schema defines the **template's placeholders** — the dynamic data that gets rendered into the email HTML. These can differ from the API input (e.g. the API receives `to` + `userName`, but the template also needs `dashboardUrl` which the service constructs).

Add an entry to the `EmailTemplates` object:

```typescript
export const EmailTemplates = {
  invite: { /* existing */ },
  welcome: {
    schema: z.object({
      userName: z.string(),
      dashboardUrl: z.url(),
    }),
    subject: (data: { userName: string }) =>
      `Welcome, ${data.userName}!`,
  },
};
```

- **`schema`**: Defines the template's placeholders (component props)
- **`subject`**: Generates the email subject line dynamically from placeholder data

### 3. Create the Template Component (`apps/server/src/email/templates/<name>.template.tsx`)

Create `apps/server/src/email/templates/welcome.template.tsx`:

```tsx
import { Button, Heading, Text } from "@react-email/components";
import * as React from "react";
void React;
import { EmailLayout } from "../components/email-layout";
import { styles } from "../components/styles";
import type { EmailTemplateData } from "@repo/shared";

export function WelcomeEmailTemplate({
  userName,
  dashboardUrl,
}: EmailTemplateData<"welcome">) {
  return (
    <EmailLayout footerText="You received this because you signed up.">
      <Heading style={styles.heading}>Welcome, {userName}!</Heading>
      <Text style={styles.text}>Your account is ready.</Text>
      <Button style={styles.button} href={dashboardUrl}>
        Go to Dashboard
      </Button>
    </EmailLayout>
  );
}
```

Key points:
- Add `void React;` at the top of the file (after the import) to prevent unused import lint errors since JSX uses React implicitly
- Props type is `EmailTemplateData<"welcome">` — derived from `EmailTemplates.welcome.schema`
- Wrap in `EmailLayout` for consistent styling
- Use components from `@react-email/components` (not regular HTML)
- Use `styles` from `../components/styles` for design system colors

### 4. Register in Template Map (`apps/server/src/email/templates/index.ts`)

```typescript
import { WelcomeEmailTemplate } from "./welcome.template";

export const templateMap: EmailTemplateMap = {
  invite: InviteEmailTemplate,
  welcome: WelcomeEmailTemplate,
};
```

### 5. Add Contract (`packages/orpc-contracts/src/contracts/email.contract.ts`)

```typescript
export const emailContract = {
  invite: oc.input(InviteEmailInputSchema).output(InviteEmailSendResultSchema),
  welcome: oc.input(WelcomeEmailInputSchema).output(WelcomeEmailSendResultSchema),
};
```

### 6. Add Service + Controller

Service (`apps/server/src/controllers/email/email.service.ts`):
```typescript
export async function sendWelcomeEmail(userId: string, input: { to: string; userName: string }) {
  return sendEmail({
    to: input.to,
    template: "welcome",
    data: {
      userName: input.userName,
      dashboardUrl: env.CORS_ORIGIN + "/portal/dashboard",
    },
  });
}
```

Controller (`apps/server/src/controllers/email/email.controller.ts`):
```typescript
welcome: protectedProcedure.email.welcome.handler(async ({ context, input }) => {
  return sendWelcomeEmail(context.userId, input);
}),
```

### 7. Add Frontend Hook (`apps/web/src/api/email.api.ts`)

```typescript
export function useWelcomeEmail({ onSuccess }: { onSuccess: (data: { id: string }) => void }) {
  return useMutation(
    orpc.email.welcome.mutationOptions({
      onSuccess: (data) => {
        onSuccess(data);
        toast.success("Welcome email sent!");
      },
    }),
  );
}
```

## What You DON'T Need To Do

- **No manual HTML** — React Email renders components to HTML
- **No subject line in send call** — derived automatically from `EmailTemplates[template].subject()`
- **No Resend API calls** — `sendEmail()` handles rendering + sending
- **No input validation in handlers** — oRPC validates against contract schemas automatically

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Forgot to add to `templateMap` | Runtime error: component not found. Always update `templates/index.ts` |
| Used HTML tags instead of React Email components | Emails render incorrectly. Use `<Text>`, `<Button>`, `<Heading>` etc. |
| Props don't match schema | Type error. `EmailTemplateData<"name">` must match `EmailTemplates.name.schema` |
| Forgot to export shared schemas | Contract file can't import them. Check `packages/shared/src/index.ts` |
