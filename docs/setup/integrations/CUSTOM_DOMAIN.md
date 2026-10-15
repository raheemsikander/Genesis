# Setting Up a Custom Domain

This document covers how to connect a custom domain (e.g. `staging.example.com` or `example.com`) to a Vercel environment provisioned by Terraform.

> **Optional** — Terraform auto-generates a stable `*.vercel.app` URL on first apply. The custom domain is only needed when you want the client's real domain on the deployed app.

> **Prerequisite** — you've already followed [`../STAGING.md`](../STAGING.md) (or `PRODUCTION.md`) and the env's first `terraform apply` succeeded with the auto-generated `*.vercel.app` URL.

---

## Step 1 — Set `TF_VAR_frontend_domain` in `.envrc`

```bash
cd /path/to/project/infra/terraform/envs/<staging|production>
$EDITOR .envrc
```

Set:

```bash
export TF_VAR_frontend_domain="staging.example.com"
```

Then:

```bash
source .envrc
terraform apply
```

The plan adds the domain claim to Vercel and updates the env vars that depend on the public URL. Render's `CORS_ORIGIN` automatically follows via the cross-module wire — no other Terraform edits.

---

## Step 2 — Get the DNS records from Vercel

After apply succeeds, open **Vercel Dashboard → your project → Domains** and click the domain you just added. Vercel shows the exact DNS records to add at your registrar — the value is project-specific (e.g. `4d59eed94f1ab4a0.vercel-dns-016.com`), so always copy it from the dashboard rather than typing one in.

Add the record at your DNS provider with TTL `Auto` (or `3600` if your provider requires a number), then wait for Vercel to verify. SSL provisions automatically once verification passes — usually a few minutes, occasionally up to 48 hours depending on DNS propagation.

---

If you want to undo the custom domain later, set `TF_VAR_frontend_domain=""` in `.envrc` and apply again — the *.vercel.app URL takes over.
