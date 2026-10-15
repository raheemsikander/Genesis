# Setting Up a Custom Domain (manual / legacy)

> **The canonical custom-domain flow is now [`../integrations/CUSTOM_DOMAIN.md`](../integrations/CUSTOM_DOMAIN.md).** This file describes the manual click-through-the-dashboards flow that pairs with the legacy `STAGING_ENV.md` / `PROD_ENV.md` / `NEW_ENV.md` setup. Kept as a backup.

This document covers how to connect a custom domain to any Vercel environment (staging, production, etc.).

> **Optional** — a custom domain isn't required. Production gets a `*.vercel.app` domain automatically; for pre-production environments (staging, etc.) you'll need to either assign a Vercel-provided domain (e.g. `your-project-staging.vercel.app`) or a custom one so the environment has a stable URL.

---

## Step 1 — Add the domain in Vercel

1. Go to **Project → Domains**
2. Enter the domain (e.g. `staging.example.com` or `example.com`)
3. Assign it to the correct environment (e.g. **staging**, **Production**)
4. Vercel will display the DNS records you need to configure

---

## Step 2 — Configure DNS

Go to your DNS provider and add the record Vercel shows you. Wait for Vercel to show **Valid Configuration** under **Project → Domains** — can take a few minutes up to 48 hours. SSL is provisioned automatically.

---

## Step 3 — Update CORS_ORIGIN on Render

1. Render Dashboard → **Environment Groups** → `<env>-secrets` (e.g. `staging-secrets`, `production-secrets`)
2. Set `CORS_ORIGIN` to the full domain URL (include `https://`, no trailing slash)
3. Trigger a **manual deploy** on both the API and worker services
