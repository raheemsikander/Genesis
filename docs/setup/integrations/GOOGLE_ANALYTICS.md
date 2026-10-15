# Setting Up Google Analytics 4

This document covers how to set up Google Analytics 4 (GA4) for web analytics and UTM campaign tracking on the frontend (`apps/web`).

> **Optional**: should ideally be configured for **staging** and **production**. For local development, leave `NEXT_PUBLIC_GA4_MEASUREMENT_ID` unset to keep the tag and all network traffic off by default.

---

## Step 1: Create a GA4 property and a Web data stream

1. Go to [analytics.google.com](https://analytics.google.com) and sign in (or create a Google account for the team first).
2. Create one **Property** per environment so events from staging and production stay separated:

| GA4 Property | Purpose |
|---|---|
| `<app>-web-staging` | Frontend events from the staging deploy |
| `<app>-web-prod` | Frontend events from production |

   You can also reuse a single property across environments and filter by hostname, but separate properties are cleaner for reporting and access control.
3. Inside the property, go to **Admin -> Data Streams -> Add stream -> Web**. Enter the environment's deployed URL and a stream name matching the property.

> GA4 is free with generous limits for most product analytics use cases. If you outgrow the free tier, look up Google Analytics 360 pricing.

---

## Step 2: Get the measurement ID

1. Open the Web data stream you just created.
2. Copy the **Measurement ID** shown at the top right (format: `G-XXXXXXXXXX`).
3. Paste it into the appropriate env var:

| Environment | Where | Variable |
|---|---|---|
| Local | `apps/web/.env.local` (leave unset to keep the integration off) | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` |
| Staging | Vercel project env vars (Staging) | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` |
| Production | Vercel project env vars (Production) | `NEXT_PUBLIC_GA4_MEASUREMENT_ID` |

Staging and production values for deployed environments are owned by Terraform, not set by hand in the Vercel dashboard. Add the measurement ID to `infra/terraform/envs/<staging|production>/.envrc` and apply:

```bash
export TF_VAR_next_public_ga4_measurement_id="G-XXXXXXXXXX"
```

Leaving it empty is valid and keeps GA4 off for that environment. See [`UPDATE_ENV_VARS.md`](../UPDATE_ENV_VARS.md) for the full apply procedure.

Only a `G-`-prefixed measurement ID activates the tag. Anything else (a `GTM-` container ID, a `UA-` property, the numeric Stream ID sitting next to the measurement ID in the same panel) leaves GA4 off rather than failing the build, so check Step 4 if you expect data and see none.

---

## Step 3: Turn off history-based page views in Enhanced Measurement

**Required, once per data stream. Do this before sending real traffic.**

In the Web data stream, open **Enhanced measurement -> (gear icon) -> Page views**, expand **Show advanced settings**, and clear **Page changes based on browser history events**. Leave every other Enhanced Measurement option alone.

That option is on by default and makes gtag.js fire its own `page_view` the instant `history.pushState` runs. Two reasons it has to go:

- The app already sends one `page_view` per route change itself (`GoogleAnalyticsProvider`), so leaving it on double-counts every client-side navigation.
- gtag.js fires that hit synchronously from inside `pushState`, before React has committed the route, which is earlier than the app can hand the tag a scrubbed URL. It is the one hit whose `page_location` the app cannot control, and this app's URLs carry an invitee email and a live invitation ticket. See [What is not sent](#what-is-not-sent).

The remaining Enhanced Measurement events (`scroll`, `form_start`, `user_engagement`) are safe to leave on: they read the last page identity the app set on the tag, not the raw document URL.

---

## Step 4: Verify

1. With the measurement ID set in `.env.local`, run `pnpm dev:web`.
2. Open GA4 -> **Reports -> Realtime**.
3. Navigate around the app in another tab. Within a few seconds you should see an active user and a stream of `page_view` events, one per route change (client-side navigations included, since the App Router never reloads the document). Exactly one per navigation confirms Step 3 took effect.
4. Visit a URL carrying UTM params, e.g. `http://localhost:3001/?utm_source=newsletter&utm_medium=email&utm_campaign=launch`, and confirm the Realtime view attributes the session to that source and medium.
5. Open a page with a non-campaign query string, e.g. `http://localhost:3001/sign-in?redirect_url=%2Fportal%2Fusers`, and check the DebugView payload: `page_location` and `page_referrer` must end at the pathname, with the `redirect_url` gone. Only `utm_*` and the Google click IDs (`gclid`, `gbraid`, `wbraid`, `dclid`) survive.

---

## How UTM tracking works

`apps/web/src/utils/utm.ts` reads standard `utm_*` query params off the landing URL and maps each one to the GA4 dimension it natively supports, so no custom dimension registration is required in GA4:

| URL param | GA4 dimension |
|---|---|
| `utm_id` | `campaign_id` |
| `utm_source` | `campaign_source` |
| `utm_medium` | `campaign_medium` |
| `utm_campaign` | `campaign_name` |
| `utm_term` | `campaign_term` |
| `utm_content` | `campaign_content` |

UTM params are only present on the URL a visitor actually landed on. Since App Router navigations are client-side and never reload the page, the parsed campaign is persisted in `sessionStorage` under the key `ga_campaign` so every subsequent event in the session keeps the same attribution.

Attribution follows a last-non-direct-touch model: a URL carrying UTM params overwrites whatever campaign was already stored for the session, while a URL without them leaves the stored campaign untouched. A visitor who lands with `utm_source=newsletter`, then later clicks an internal link with no UTM params, still gets `newsletter` attributed to every event in that session.

The resolved `campaign_*` params are set at **tag** scope, in the `config` call and refreshed via `gtag("set", ...)` on each route change. GA4 only reads `campaign_*` there; passed as event params they arrive as unregistered custom params and never reach the attribution model. `utm_*` and the Google click IDs also survive the query-string scrub into `page_location` (see [What is not sent](#what-is-not-sent)), which is where GA4 resolves a session's traffic source natively.

Two consequences of that scope worth knowing:

- `gtag("set", ...)` merges into the tag's state rather than replacing it, so the refresh names **every** campaign key, with `null` for the ones the current campaign does not carry. Without that, a visitor going from `?utm_source=newsletter&utm_medium=email` to `?utm_source=twitter` would keep `campaign_medium=email` pinned for the rest of the document's life.
- A landing URL carrying a Google click ID (`gclid`, `gbraid`, `wbraid` or `dclid`) but no `utm_*` is treated as a non-direct touch of its own: the stored campaign is cleared and no `campaign_*` is set, so GA4 resolves the paid click out of `page_location` instead of having an hour-old newsletter reasserted over it.

---

## Sending a custom event

Import the `googleAnalytics` singleton from `apps/web/src/utils/google-analytics.ts` and call `trackEvent`:

```ts
import { googleAnalytics } from "../../utils/google-analytics";

googleAnalytics.trackEvent("invite_sent", { role: "member" });
```

GA4 event names are conventionally `snake_case`, unlike the Mixpanel event names in `analytics.ts`.

`trackEvent` is a no-op when `NEXT_PUBLIC_GA4_MEASUREMENT_ID` is unset, so it is always safe to call regardless of environment. Pass only the params your event needs: the session's campaign attribution already sits on the tag, so every event picks it up without being handed it.

Page views and user identity are already wired up and do not need manual calls: `GoogleAnalyticsProvider` (in `apps/web/src/providers/google-analytics-provider.tsx`) sends a `page_view` on every route change and syncs the signed-in Clerk user id via `setUserId`, clearing it on sign-out.

---

## What is not sent

Query strings are allowlisted down to `utm_*` and the Google click IDs (`gclid`, `gbraid`, `wbraid`, `dclid`), the params GA4 itself reads for attribution. Every other param is dropped from `page_location` and from `page_referrer` (which is otherwise `document.referrer` in full). The reason is that this app's URLs carry values that must not leave it: `/verify-email?email=...` holds an address, `/sign-up?__clerk_ticket=...` holds a live single-use invitation credential, and the sign-in redirect adds the portal path the visitor was trying to reach.

The scrubbed location and referrer are set on the tag itself (in the `config` call, and refreshed on every route change), not just on the page view the app sends. GA4's Enhanced Measurement events (`scroll`, `form_start`, `user_engagement`) are generated inside gtag.js and would otherwise read the raw document URL and `document.referrer` directly.

A referrer that is not `http`/`https` (`android-app://` for links opened from a native Android app, `about:`, any custom scheme) is reported as empty rather than passed through, so the session reads as direct instead of being pinned to a referrer GA4 cannot resolve.

The one hit this cannot cover is the history-based page view, which gtag.js fires from inside `pushState` before the app can refresh the tag. That is why turning it off in [Step 3](#step-3-turn-off-history-based-page-views-in-enhanced-measurement) is required rather than optional: with it on, a client-side navigation to `/verify-email?email=...` sends the address to Google no matter what this code does.

If you add an event param of your own, check the same way: pass named values, never a whole URL.

A query change is still counted as a distinct page view (a filter change is a real navigation), and GA4 sees the pre-scrub query only insofar as it is campaign data.

---

## Consent management caveat

This integration does not implement a consent banner or Google's consent mode. The gtag script loads and starts sending events as soon as the page is interactive, with no opt-in or opt-out gate. Before enabling this for EU traffic (or any jurisdiction requiring consent before analytics cookies are set), add a consent management layer and wire it into `google-analytics-provider.tsx` ahead of the `init()` call.
