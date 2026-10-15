# Setting Up Rollbar

This document covers how to set up Rollbar for error tracking.

> **Optional** — should ideally be configured at least for the **production** environment. For other environments (staging, etc.), enable it based on your team's requirements.

---

## Step 1 — Create a Rollbar account

1. Go to [rollbar.com](https://rollbar.com) and sign up
2. The signup flow creates an organization automatically — pick a name for your team

---

## Step 2 — Create projects

Create separate projects for the server and client to keep their error streams isolated:

1. Go to **Projects → Create New Project**
2. Pick any framework when asked — it only affects the onboarding tutorial. **Close the tutorial** (X in top right) — the SDK is already configured in our code.
3. Repeat for the second project.

| Rollbar Project | Purpose |
|---|---|
| `genesis-server-<env>` | Backend (Express) errors |
| `genesis-client-<env>` | Frontend (Next.js) errors |

Replace `<env>` with the environment (e.g. `prod`, `staging`).

---

## Step 3 — Create access tokens

Create the following tokens (the client project needs two — one for the frontend SDK, one for source map uploads):

1. Go to **Project → Settings → Project Access Tokens**
2. Click **+ Create New Token**

| Rollbar Project | Token scope | Use as | Where |
|---|---|---|---|
| `genesis-server-<env>` | `post_server_item` | `ROLLBAR_SERVER_TOKEN` | Render env secrets for that environment |
| `genesis-client-<env>` | `post_client_item` | `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN` | Vercel env vars for that environment |
| `genesis-client-<env>` | `post_server_item` | `ROLLBAR_CLIENT_SOURCEMAP_TOKEN` | Vercel env vars (source maps are uploaded during Vercel's build) |

> **Important:** The access token is **only shown once** when created. Copy and save it immediately — after that, only the Public ID is visible (which is NOT the access token).

Keep these tokens handy — you'll paste them into Render and Vercel env vars when following the environment setup docs (staging / prod / adding a new env).

---

## Step 4 — (Optional) Verify with a test error

Rollbar marks a project as **"Setup incomplete"** in its dashboard until it receives its first error event. To clear that state before your first real error hits production, send a test event from local:

> Do this **once per project** (server and client are separate). Remove the tokens from your local `.env` afterward so dev errors don't pollute the production Rollbar stream.

### Test the server project (`genesis-server-<env>`)

1. In `apps/server/.env`, set:
   ```
   ROLLBAR_SERVER_TOKEN=<post_server_item token you copied in Step 3>
   ```
2. Open `apps/server/src/index.ts`, find the `/health` handler (currently `app.get("/health", ...)`), and temporarily add a Rollbar call inside it:
   ```ts
   app.get("/health", (_req, res) => {
     rollbar.error(new Error("rollbar test — delete me")); // add this
     res.json({ ok: true });
   });
   ```
3. Start (or restart) the app: `pnpm dev`
4. Hit the endpoint: `curl http://localhost:3000/health` (or open it in your browser).
5. Open Rollbar → `genesis-server-<env>` project → **Items**. The error should appear within ~10 seconds, and the "Setup incomplete" banner clears.
6. Revert the added line in `src/index.ts` and remove `ROLLBAR_SERVER_TOKEN` from `apps/server/.env`.

### Test the client project (`genesis-client-<env>`)

1. In `apps/web/.env`, set:
   ```
   NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN=<post_client_item token you copied in Step 3>
   ```
2. Open any client page component under `apps/web/src/app/` and temporarily add a button that throws:
   ```tsx
   <button type="button" onClick={() => { throw new Error("rollbar test — delete me"); }}>
     test rollbar
   </button>
   ```
3. Start (or restart) the app: `pnpm dev` (`NEXT_PUBLIC_*` vars are baked in at build time, so a restart is required).
4. Load the page in your browser and click the button.
5. Open Rollbar → `genesis-client-<env>` project → **Items**. The error should appear within ~10 seconds.
6. Revert the button change and remove `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN` from `apps/web/.env`.
6. Revert the button change and remove `NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN` from `apps/web/.env`.

