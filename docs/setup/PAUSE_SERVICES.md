# Pausing Render Services

The `service_enabled` flag stops the web service and worker without touching stateful resources (Postgres, Redis, R2, env group). Use it when you need to take services down temporarily — billing stops, data survives.

---

## Pausing

1. In `infra/terraform/envs/<staging|production>/terraform.tfvars`, set:

   ```hcl
   service_enabled = false
   ```

2. Apply:

   ```bash
   cd infra/terraform/envs/<staging|production>
   source ../shared/.envrc && source .envrc
   terraform apply
   ```

   The plan will destroy `render_web_service.main[0]` (and `render_background_worker.main[0]` if the worker was enabled). Postgres, Redis, R2, and the env group are untouched.

> **Side effects:** While paused, `RENDER_API_SERVICE_ID` in GitHub Actions is written as `""` and Vercel's `NEXT_PUBLIC_SERVER_URL` points at `""` — the frontend will be broken. Expected.

---

## Resuming

Set `service_enabled = true` and re-apply. Terraform recreates the web service (and worker if `enable_worker = true`) and triggers a fresh deploy once the env group link is in place. The redeploy step polls Render's deploy-status API until `status: live` — expect a 3–5 minute pause on that step before Terraform exits.
