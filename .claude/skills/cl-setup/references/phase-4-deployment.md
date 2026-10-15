# Phase 4: Deployment

**Goal:** App deployed to Render (backend) + Vercel (frontend) with automated deploys via GitHub Actions.

**Docs:**
- `docs/setup/STAGING_ENV.md` — staging environment
- `docs/setup/PROD_ENV.md` — production environment

These docs are thorough. Follow them step by step. This reference only adds context, verification, and troubleshooting.

---

## State Check

Ask the engineer:
- Which environment? (staging or production)
- Do they have Render and Vercel accounts?
- Have they started any of the setup steps?

---

## Context

Explain the deployment architecture before starting — it's not obvious from the docs alone:

```
PR merged to develop/main
        │
        ▼
GitHub Actions (deploy.yml)
        │
        ├── 1. Run database migrations
        ├── 2. Trigger Render API deploy (webhook)
        ├── 3. Trigger Render worker deploy (webhook)
        └── 4. Trigger Vercel frontend deploy (webhook)
```

Auto-deploy is disabled on both Render and Vercel. All deploys go through the GitHub Actions workflow, which ensures migrations run first. The worker deploy (step 3) is handled automatically by the workflow — no separate setup is needed beyond creating the Render service.

---

## Verification & Troubleshooting

### After doc Step 1 (Render setup)

Confirm with the engineer: "Have all Render services been created? The Blueprint should have created: API service, worker service, PostgreSQL, and Redis."

First deploy will fail because secrets aren't set yet — that's expected (doc says this).

### After doc Step 2 (Database migrations)

**Verify:** `pnpm db:migrate` exits with code 0.

**Timeout:** Render free-tier databases spin down when idle. First connection may take 30–60 seconds. Try again.

**Remind:** Always append `?sslmode=require`. Use the **External** Database URL (not Internal).

### After doc Step 3 (Vercel setup)

**Don't miss the deploy hook.** Confirm the engineer created it (Project → Settings → Git → Deploy Hooks). Easy to skip, critical for deploys.

**For staging: custom domain is required.** Vercel doesn't auto-assign stable URLs to pre-production environments.

### After doc Step 5 (CORS_ORIGIN)

**Common mistake:** Using `http://` instead of `https://`, or including a trailing slash. Both cause CORS failures.

### After doc Step 6 (First deploy + verification)

Walk through the doc's verification checklist. If the frontend shows a blank page or CORS errors, double-check that `CORS_ORIGIN` on Render matches the Vercel URL exactly.

---

## Phase 4 Complete

When the app is live and the full auth flow works on the deployed environment.

**What's next:** Point the engineer to optional integrations in the README — Codecov, R2 storage, Rollbar, repo security.
