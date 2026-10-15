// render module — env-scoped resource graph (the render_project + environments
// are owned by the shared env-root, not this module):
//
//   var.environment_id (from shared)
//   ├── render_env_group              (operator env vars; prevent_destroy)
//   ├── render_postgres               (prevent_destroy)
//   │     └── terraform_data.migrate  (pnpm db:migrate via local-exec)
//   │           ├── render_web_service              (depends_on migrate)
//   │           └── render_background_worker[0]     (count = enable_worker ? 1 : 0)
//   └── render_keyvalue               (Redis; ip_allow_list = [])
//
//   render_env_group_link.main           (single link object; service_ids = [web, worker?])
//   terraform_data.web_redeploy_on_env_change       (POSTs Render REST deploy on env change)
//   terraform_data.worker_redeploy_on_env_change[0] (same, gated on enable_worker)
//
//   check.postgres_plan_for_production    (warns on free Postgres for production)
//
// render-oss/render v1.x quirks:
//   - No standalone `render_environment` — environments are a nested map on
//     `render_project.environments`. The shared env-root owns that resource;
//     here we receive the resolved ID via var.environment_id.
//   - `render_env_group.env_vars` shape is `{ KEY = { value = "..." } }`, not
//     map(string).

locals {
  resource_prefix = "${var.project_name}-${var.environment}"
}

// Operator-provided secrets bag. One row per server-side env var declared in
// apps/server/src/utils/env.ts; the web service pulls them in via env_group_link.
resource "render_env_group" "main" {
  name           = "${local.resource_prefix}-secrets"
  environment_id = var.environment_id

  env_vars = {
    CORS_ORIGIN = {
      value = var.cors_origin
    }
    CLERK_SECRET_KEY = {
      value = var.clerk_secret_key
    }
    CLERK_PUBLISHABLE_KEY = {
      value = var.clerk_publishable_key
    }
    RESEND_API_KEY = {
      value = var.resend_api_key
    }
    RESEND_FROM_EMAIL = {
      value = var.resend_from_email
    }
    S3_ENDPOINT = {
      value = var.s3_endpoint
    }
    S3_PUBLIC_ENDPOINT = {
      value = var.s3_public_endpoint
    }
    S3_ACCESS_KEY_ID = {
      value = var.s3_access_key_id
    }
    S3_SECRET_ACCESS_KEY = {
      value = var.s3_secret_access_key
    }
    S3_REGION = {
      value = var.s3_region
    }
    S3_BUCKET = {
      value = var.s3_bucket
    }
    ROLLBAR_SERVER_TOKEN = {
      value = var.rollbar_server_token
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}
