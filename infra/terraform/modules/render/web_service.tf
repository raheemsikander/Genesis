// Render Web Service for the API.
//
// Schema notes (render-oss/render v1.x — verified against provider source
// `internal/provider/webservice/resource/schema.go` and
// `internal/provider/types/resource/runtimesource.go`):
//   - `runtime_source` is a SingleNestedAttribute (object syntax with `=`),
//     not an HCL block. Use exactly one of `native_runtime`, `docker`, or
//     `image` keys inside it.
//   - The `docker` sub-attribute uses `context` (NOT `docker_context`) and
//     `dockerfile_path`. `repo_url` and `branch` are required; `auto_deploy`
//     defaults to true so we explicitly set it false (CI triggers deploys via
//     the Render REST API after migrations finish).
//   - The web service does NOT accept `env_var_group_ids`. Env groups are
//     attached out-of-band via `render_env_group_link` (see bottom of file).
//   - `env_vars` is a MapNestedAttribute shaped `{ KEY = { value = "..." } }`,
//     same shape as `render_env_group.env_vars`.
//   - There is no `deploy_hook_url` attribute on the resource and no
//     standalone `render_deploy_hook` resource in the provider. Deploys are
//     triggered from CI via the Render REST API
//     (`POST /v1/services/{id}/deploys` with a Bearer API key). The module
//     exposes `api_service_id` for that purpose; see `outputs.tf`.
//   - `lifecycle.ignore_changes = [runtime_source]` keeps Render's commit
//     SHA churn out of the Terraform plan once the service exists.

resource "render_web_service" "main" {
  count = var.service_enabled ? 1 : 0

  environment_id = var.environment_id
  name           = "${local.resource_prefix}-api"
  plan           = var.web_service_plan
  region         = var.region

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = var.branch
      auto_deploy     = false
      dockerfile_path = var.dockerfile_path
      context         = var.docker_context
    }
  }

  health_check_path = var.health_check_path

  env_vars = {
    NODE_ENV = {
      value = "production"
    }
    DATABASE_URL = {
      // Internal Render Postgres uses a cert signed by Render's internal CA,
      // which Node 22+ rejects under the default `sslmode=require` (strict
      // verification). `sslmode=no-verify` is the pg-connection-string
      // shorthand for `ssl: { rejectUnauthorized: false }` — TLS still
      // encrypts the wire, just skips cert verification. Safe on Render's
      // private network. Migrations (run from the engineer's laptop via
      // terraform_data.migrate) keep `sslmode=require` because the external
      // URL chains to a public CA.
      value = "${render_postgres.main.connection_info.internal_connection_string}?sslmode=no-verify"
    }
    REDIS_URL = {
      value = render_keyvalue.main.connection_info.internal_connection_string
    }
  }

  depends_on = [terraform_data.migrate]

  lifecycle {
    ignore_changes = [
      runtime_source,
      // The render-oss provider reads back paid-tier-only fields like
      // `maintenance_mode`, `notification_override`, `previews`,
      // `pull_request_previews_enabled`, `log_stream_override`, and
      // `num_instances`, then re-sends them on every UPDATE call. Render's
      // free-tier API rejects those fields with errors like
      // "maintenance mode can only be configured for non-free tier services".
      // Ignoring drift on them keeps the provider from sending values the
      // free-tier API doesn't accept. Forks on paid plans can shrink this
      // list if they want to manage these fields explicitly.
      maintenance_mode,
      notification_override,
      previews,
      log_stream_override,
      num_instances,
    ]
  }
}

// Link the operator-provided env group (CORS, Clerk, Resend, S3, Rollbar) to
// the services that need it. Render's API allows ONE env_group_link object
// per env_group, holding a list of service IDs — two separate resources
// targeting the same env_group_id collide ("service link already exists").
// We list the web service unconditionally and append the worker only when
// it's enabled.
resource "render_env_group_link" "main" {
  count = var.service_enabled ? 1 : 0

  env_group_id = render_env_group.main.id
  service_ids = concat(
    [render_web_service.main[0].id],
    var.enable_worker ? [render_background_worker.main[0].id] : [],
  )
}

// Trigger a fresh Render deploy after the env group link is created (or
// after env_vars change), then block until it's live. Render's first deploy
// fires when render_web_service is created, BEFORE the env group link exists
// — so that deploy boots without the operator-provided env vars and crashes
// at startup (t3-env validation rejects undefined CORS_ORIGIN / CLERK_*).
// This resource calls scripts/verify-deploy.ts which POSTs to Render's REST
// deploy endpoint and then polls the deploy-status API until status === live
// (or fails fast on a terminal error state). Polling the platform API — not
// /health — is what makes day-2 env-var rotations report accurately, because
// Render keeps the previous container serving traffic during a rolling
// deploy.
//
// triggers_replace: fires when the link is recreated OR when any env_vars
// value in the group changes — covers first-time creation AND day-2 secret
// rotations / config changes (so engineers don't need a manual redeploy).
resource "terraform_data" "web_redeploy_on_env_change" {
  count = var.service_enabled ? 1 : 0

  triggers_replace = {
    service_id        = render_web_service.main[0].id
    env_group_id      = render_env_group.main.id
    env_vars_checksum = sha256(jsonencode(render_env_group.main.env_vars))
  }

  depends_on = [render_env_group_link.main]

  provisioner "local-exec" {
    working_dir = "${path.module}/../../../.."
    environment = {
      RENDER_SERVICE_ID = render_web_service.main[0].id
    }
    command     = "pnpm verify-deploy render"
    interpreter = ["/bin/bash", "-c"]
  }
}
