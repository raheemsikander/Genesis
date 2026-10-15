# Setting Up Mixpanel

This document covers how to set up Mixpanel for product analytics and session replay on the frontend (`apps/web`).

> **Optional** — should ideally be configured for **staging** and **production**. For local development, leave `NEXT_PUBLIC_MIXPANEL_TOKEN` unset to keep all tracking and replay traffic off by default.

---

## Step 1 — Create a Mixpanel organization and projects

Mixpanel's hierarchy is **Organization → Projects**. The Org is the top-level account that holds billing, the plan, and team access. Each **Project** sits inside the Org with its own token, events, dashboards, and replays.

1. Go to [mixpanel.com](https://mixpanel.com) and sign up — this creates your Organization (name it after your company / team).
2. Inside the Org, create one Project per environment so events from staging and production stay separated:

| Mixpanel Project | Purpose |
|---|---|
| `genesis-web-staging` | Frontend events from the staging deploy |
| `genesis-web-prod` | Frontend events from production |

You can also reuse a single project across environments and filter by the `environment` super property attached to every event — but separate projects are cleaner for retention and access control.

> Mixpanel has decent free-tier limits across events, replays, and reports — no upgrade required to get started. If your Org outgrows them, look up the latest pricing and upgrade from **Plan & Billing**.

---

## Step 2 — Get the project token

1. Open the project → **Project Settings** → **Project Token**.
2. Copy the token.
3. Paste it into the appropriate env var:

| Environment | Where | Variable |
|---|---|---|
| Local | `apps/web/.env.local` — leave unset to keep tracking off | `NEXT_PUBLIC_MIXPANEL_TOKEN` |
| Staging | Vercel project env vars (Staging) | `NEXT_PUBLIC_MIXPANEL_TOKEN` |
| Production | Vercel project env vars (Production) | `NEXT_PUBLIC_MIXPANEL_TOKEN` |

---

## Step 3 — Verify

1. With the token set in `.env.local`, run `pnpm dev:web`.
2. Sign up, sign in, and sign out. Open Mixpanel → **Events** → **Live View**.
3. Within ~10 seconds the events (`Sign In`, `Sign Up`, `Sign Out`, and `Page View`) should appear with the active user identified. Each `Sign In` / `Sign Up` event carries a `stage` property:

   | `stage` | When it fires | Notes |
   |---|---|---|
   | `"initiated"` | Click-time (OAuth only) — before redirect to Google | User may still cancel at Google's consent screen; **exclude from completion funnels by filtering `stage="completed"`** |
   | `"completed"` | After Clerk confirms success (password flows only) | Outcome-accurate |

   For OAuth flows, `Sign In` / `Sign Up` reflects the **page the user clicked from** (intent), not the eventual outcome — e.g. a Google identity already linked to an account clicked from `/sign-up` still fires `Sign Up`, even though Clerk silently signs them in. Password flows are exact.
4. Open **Recordings** — a session replay should appear within a minute. Sampling is set to **50%** (`record_sessions_percent: 50` in `apps/web/src/utils/analytics.ts`), so if no recording shows up, close the tab and start a fresh session — roughly half of sessions are recorded, so a single miss isn't unusual. Type into any input field during the session and verify the value is masked in the replay (all input values are masked by default — see the next section).

---

## Identity sync

When Clerk reports a signed-in user, `MixpanelProvider` calls `analytics.identify(user.id)` and writes the following profile properties from the Clerk `useUser()` hook:

| Mixpanel property | Source (Clerk `user.*`) |
|---|---|
| `$email` | `primaryEmailAddress.emailAddress` |
| `$first_name` | `firstName` |
| `$last_name` | `lastName` |
| `$created` | `createdAt` (ISO string) — Mixpanel's reserved "first-seen" property |

`$created` enables cohort analysis on returning users (e.g. "users created before X who signed in this week"). On sign-out, `MixpanelProvider` calls `analytics.reset()` to break the link between the distinct ID and the anonymous next session.

---

## Masking PII in session replays

Session replays capture the rendered DOM. To prevent leaking user data:

- **Input values** are masked automatically — anything typed into `<input>` or `<textarea>` is never sent to Mixpanel, regardless of input type.
- **Rendered DOM text** (e.g. a user's name in the sidebar, an email shown on the profile page) must be explicitly tagged. Add `className="mp-mask"` to any element whose text content includes user PII. Mixpanel is configured with `record_mask_text_class: "mp-mask"` in `apps/web/src/utils/analytics.ts`; elements carrying that class have their text replaced with `*`s in the replay.

Example:

```tsx
<p className="mp-mask">{user.primaryEmailAddress?.emailAddress}</p>
```

When you add a new component that renders user data (name, email, phone, address, etc.), apply the class on the rendering element. The platform ships with the pattern applied to the portal welcome banner, profile page, and sidebar user info — use those as references.
