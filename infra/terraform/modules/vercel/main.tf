// vercel module — env-scoped resource graph (the vercel_project itself is
// owned by the shared env-root):
//
//   var.project_id, var.deploy_hook_id, var.deploy_hook_url   (from shared)
//   ├── vercel_custom_environment[0]        (for non-production envs only)
//   ├── vercel_project_domain               (custom or auto-generated *.vercel.app)
//   └── vercel_project_environment_variable (one per app env var; for_each)
//
//   random_id.domain_suffix                 (stable random suffix in state)
//   local_sensitive_file.vercel_deploy_hook (0600 file holding the deploy hook URL)
//   terraform_data.vercel_initial_deploy    (POSTs the deploy hook on env_vars change)
//
// Prereq: The Vercel GitHub App must already be installed on the org and
// have access to the target repo, AND the shared env-root must have been
// applied to create the project + deploy hooks.

locals {
  // Vercel provider normalizes empty string to null on read. If we pass ""
  // (e.g. operator left TF_VAR_vercel_team_id="" in .envrc for personal
  // accounts), the provider stores "" but reads back null, and the next
  // refresh aborts with "inconsistent result after apply". Coerce up front.
  team_id = var.vercel_team_id == "" ? null : var.vercel_team_id

  is_production = var.environment == "production"

  // For env vars: production uses target=["production"]; non-prod custom envs
  // attach via custom_environment_ids. The provider rejects setting both — pass
  // null for the unused side.
  env_target             = local.is_production ? toset(["production"]) : null
  env_custom_environment = local.is_production ? null : [vercel_custom_environment.main[0].id]

  // Public frontend domain. Use the operator override when provided
  // (custom domain or explicit *.vercel.app name); otherwise auto-generate
  // <project>-<env>-<6hex>.vercel.app via random_id.domain_suffix.
  effective_domain = (
    var.frontend_domain != null && var.frontend_domain != ""
    ? var.frontend_domain
    : "${var.project_name}-${var.environment}-${random_id.domain_suffix.hex}.vercel.app"
  )
}

// Stable random suffix for the auto-generated domain. `byte_length = 3`
// produces 6 hex chars (~16M values), enough that two forks claiming the
// same `<project>-<env>-` prefix won't collide. The value is generated once
// on first apply and persists in state — subsequent applies reuse it.
resource "random_id" "domain_suffix" {
  byte_length = 3
  keepers = {
    project_name = var.project_name
    environment  = var.environment
  }
}

// Custom env for non-production deployments (staging, preview, etc.)
resource "vercel_custom_environment" "main" {
  count = local.is_production ? 0 : 1

  project_id = var.project_id
  team_id    = local.team_id
  name       = var.environment

  branch_tracking = {
    pattern = var.branch
    type    = "equals"
  }
}

// Public frontend domain. Holds either var.frontend_domain (custom or
// explicit *.vercel.app) or the auto-generated name when frontend_domain
// is unset. For custom domains, DNS records (CNAME → cname.vercel-dns.com)
// must be configured at your DNS provider; first apply may need a re-run
// while DNS propagates.
resource "vercel_project_domain" "main" {
  project_id            = var.project_id
  team_id               = local.team_id
  domain                = local.effective_domain
  custom_environment_id = local.is_production ? null : vercel_custom_environment.main[0].id
}

// =============================================================================
// First-deploy trigger
//
// Vercel auto-deploy on git push is disabled (apps/web/vercel.json sets
// git.deploymentEnabled: false), so without an explicit trigger no deployment
// happens after `terraform apply` and the *.vercel.app URL won't resolve. This
// resource POSTs to the deploy hook once env vars are configured, then polls
// Vercel's deployments API until readyState === READY (or fails fast on
// ERROR/CANCELED). Polling the platform API — not the public URL — is what
// makes day-2 env-var rotations report accurately, because Vercel keeps the
// previous deployment live until the new one is promoted.
//
// triggers_replace fires on first creation AND on env_vars changes, so day-2
// secret rotations also redeploy automatically.
//
// The deploy hook URL is sensitive — we write it to a 0600 file and source it
// inside the provisioner instead of passing via the `environment` block, which
// would trigger Terraform's blanket "suppress output" behavior and hide any
// real failure.
// =============================================================================

resource "local_sensitive_file" "vercel_deploy_hook" {
  content         = "DEPLOY_HOOK_URL=${var.deploy_hook_url}\n"
  filename        = "${path.module}/.tmp/vercel-deploy-hook.env"
  file_permission = "0600"
}

resource "terraform_data" "vercel_initial_deploy" {
  triggers_replace = {
    project_id        = var.project_id
    deploy_hook_id    = var.deploy_hook_id
    env_vars_checksum = sha256(jsonencode(local.app_env_vars))
  }

  depends_on = [
    vercel_project_environment_variable.main,
    vercel_custom_environment.main,
    vercel_project_domain.main,
    local_sensitive_file.vercel_deploy_hook,
  ]

  provisioner "local-exec" {
    working_dir = "${path.module}/../../../.."
    environment = {
      VERCEL_PROJECT_ID    = var.project_id
      VERCEL_TARGET        = local.is_production ? "production" : ""
      VERCEL_CUSTOM_ENV_ID = local.is_production ? "" : vercel_custom_environment.main[0].id
      VERCEL_TEAM_ID       = local.team_id == null ? "" : local.team_id
      VERCEL_HOOK_FILE     = abspath(local_sensitive_file.vercel_deploy_hook.filename)
    }
    command     = <<-EOT
      set -euo pipefail
      set -a
      source "$VERCEL_HOOK_FILE"
      set +a
      pnpm verify-deploy vercel
    EOT
    interpreter = ["/bin/bash", "-c"]
  }
}
