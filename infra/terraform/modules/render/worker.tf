// Render Background Worker for BullMQ async tasks.
//
// Schema notes (render-oss/render v1.x — verified against provider source
// `internal/provider/backgroundworker/resource/schema.go`):
//   - Same `runtime_source` SingleNestedAttribute shape as `render_web_service`.
//   - The worker resource has NO `health_check_path` (which the API server
//     wants but a worker has nothing to expose).
//   - The Docker runtime block has no `command` field; for Docker-backed
//     services the override-CMD goes through the top-level `start_command`
//     attribute. We use that for `var.worker_command`.
//   - Like the web service, no `env_var_group_ids` argument exists; env
//     groups are linked via `render_env_group_link` (see below). The link
//     is gated on the same toggle as the worker itself.
//   - No `deploy_hook_url` attribute. The module exposes `worker_service_id`
//     instead; CI triggers deploys via the Render REST API.
//   - `count` on the resource is fine — `terraform_data.migrate` is a
//     dependency of the whole resource group, and Terraform handles the
//     count=0 case by simply not creating the worker (no plan-time error).

resource "render_background_worker" "main" {
  count = (var.service_enabled && var.enable_worker) ? 1 : 0

  environment_id = var.environment_id
  name           = "${local.resource_prefix}-worker"
  plan           = var.worker_plan
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

  start_command = var.worker_command

  env_vars = {
    NODE_ENV = {
      value = "production"
    }
    DATABASE_URL = {
      // See comment on the same key in web_service.tf — sslmode=no-verify
      // skips cert verification on the internal Render network where
      // Postgres serves a self-signed cert that Node 22+ rejects under
      // sslmode=require. TLS still encrypts the connection.
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
    ]
  }
}

// Trigger a fresh worker deploy after the env_group link is created and on
// every env_vars value change. Same chicken-and-egg fix as
// `terraform_data.web_redeploy_on_env_change` in web_service.tf — Render's
// first auto-deploy fires before the env_group_link exists, so the worker
// boots without operator-provided env vars and crashes at startup. We call
// scripts/verify-deploy.ts which POSTs to Render's REST deploy endpoint and
// then polls the deploy-status API until status === live (or fails fast on
// a terminal error state), so `terraform apply` only exits once the worker
// is actually running with the new env vars — not when the trigger HTTP
// call returned 2xx. Gated on the same enable_worker toggle as the worker
// itself.
resource "terraform_data" "worker_redeploy_on_env_change" {
  count = (var.service_enabled && var.enable_worker) ? 1 : 0

  triggers_replace = {
    service_id        = render_background_worker.main[0].id
    env_group_id      = render_env_group.main.id
    env_vars_checksum = sha256(jsonencode(render_env_group.main.env_vars))
  }

  depends_on = [render_env_group_link.main]

  provisioner "local-exec" {
    working_dir = "${path.module}/../../../.."
    environment = {
      RENDER_SERVICE_ID = render_background_worker.main[0].id
    }
    command     = "pnpm verify-deploy render"
    interpreter = ["/bin/bash", "-c"]
  }
}
