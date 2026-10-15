# =============================================================================
# Read shared infrastructure (Vercel project, Render project) from the
# `<project>-shared` TFC workspace. Apply that workspace before this one.
# =============================================================================

data "terraform_remote_state" "shared" {
  backend = "remote"

  config = {
    organization = "project-genesis"
    workspaces = {
      name = "genesis-shared"
    }
  }
}

locals {
  shared_repo_url       = data.terraform_remote_state.shared.outputs.repo_url
  shared_branches       = data.terraform_remote_state.shared.outputs.branches
  render_environment_id = data.terraform_remote_state.shared.outputs.render_environment_ids[var.environment]
  vercel_project_id     = data.terraform_remote_state.shared.outputs.vercel_project_id
  vercel_deploy_hook    = data.terraform_remote_state.shared.outputs.vercel_deploy_hooks[var.environment]
}

# =============================================================================
# Preflight — fail at plan time if required operator secrets are unset, so
# nothing is created (or destroyed) mid-apply.
# =============================================================================

module "preflight" {
  source = "../../modules/preflight"

  environment           = var.environment
  clerk_secret_key      = var.clerk_secret_key
  clerk_publishable_key = var.clerk_publishable_key
  enable_r2             = var.enable_r2
  cloudflare_account_id = var.cloudflare_account_id
  s3_access_key_id      = var.s3_access_key_id
  s3_secret_access_key  = var.s3_secret_access_key
}

# =============================================================================
# Cloudflare R2 — optional object storage (enabled by default)
# =============================================================================

module "cloudflare" {
  source = "../../modules/cloudflare"

  project_name          = var.project_name
  environment           = var.environment
  cloudflare_account_id = var.cloudflare_account_id
  enable_r2             = var.enable_r2
}

# =============================================================================
# Render — backend (API + Postgres + Redis + worker + migrations)
# =============================================================================

module "render" {
  source = "../../modules/render"

  project_name      = var.project_name
  environment       = var.environment
  branch            = local.shared_branches[var.environment]
  repo_url          = local.shared_repo_url
  environment_id    = local.render_environment_id
  region            = var.region
  postgres_plan     = var.postgres_plan
  redis_plan        = var.redis_plan
  web_service_plan  = var.web_service_plan
  worker_plan       = var.worker_plan
  dockerfile_path   = var.dockerfile_path
  docker_context    = var.docker_context
  health_check_path = var.health_check_path
  worker_command    = var.worker_command
  enable_worker     = var.enable_worker
  service_enabled   = var.service_enabled

  // CORS_ORIGIN flows from the Vercel module's deployment URL — always.
  // Whenever that URL changes (first apply, frontend_domain change), Render's
  // env_group hash flips and `terraform_data.web_redeploy_on_env_change`
  // automatically POSTs to Render's deploy API. No manual redeploy step,
  // and no env-var override that could let stale shell state win.
  cors_origin           = module.vercel.deployment_url
  clerk_secret_key      = var.clerk_secret_key
  clerk_publishable_key = var.clerk_publishable_key
  resend_api_key        = var.resend_api_key
  resend_from_email     = var.resend_from_email
  s3_endpoint           = module.cloudflare.endpoint
  s3_public_endpoint    = var.s3_public_endpoint
  s3_access_key_id      = var.s3_access_key_id
  s3_secret_access_key  = var.s3_secret_access_key
  s3_region             = module.cloudflare.region
  s3_bucket             = module.cloudflare.bucket_name
  rollbar_server_token  = var.rollbar_server_token

  // Open external Postgres access so the local-exec migration step (running
  // from the engineer's laptop) can reach the DB. Connection is still
  // TLS-encrypted (sslmode=require) and the password is a strong random
  // string. Production may want to keep this empty/internal-only.
  postgres_ip_allow_list = [
    {
      cidr_block  = "0.0.0.0/0"
      description = "open external access for local-exec migrations"
    },
  ]
}

# =============================================================================
# Vercel — frontend
# =============================================================================

module "vercel" {
  source = "../../modules/vercel"

  project_name = var.project_name
  environment  = var.environment
  branch       = local.shared_branches[var.environment]

  vercel_team_id  = var.vercel_team_id
  project_id      = local.vercel_project_id
  deploy_hook_id  = local.vercel_deploy_hook.id
  deploy_hook_url = local.vercel_deploy_hook.url

  // Cross-module wire: Vercel's NEXT_PUBLIC_SERVER_URL points at Render's API.
  next_public_server_url = module.render.api_url

  // Reuse the Clerk creds already loaded into .envrc for Render — same Clerk app.
  clerk_secret_key      = var.clerk_secret_key
  clerk_publishable_key = var.clerk_publishable_key

  // Optional integrations (empty string disables)
  next_public_rollbar_client_token = var.next_public_rollbar_client_token
  rollbar_client_sourcemap_token   = var.rollbar_client_sourcemap_token
  next_public_mixpanel_token       = var.next_public_mixpanel_token
  frontend_domain                  = var.frontend_domain
}

# =============================================================================
# GitHub — env-scoped Actions secrets consumed by deploy.yml
# =============================================================================

// Parse owner / repo from shared's repo_url so the github module shares the
// single source of truth used by the vercel module.
locals {
  repo_path  = trimsuffix(replace(local.shared_repo_url, "https://github.com/", ""), "/")
  repo_parts = split("/", local.repo_path)
}

module "github" {
  source = "../../modules/github"

  github_owner = local.repo_parts[0]
  github_repo  = local.repo_parts[1]
  environment  = var.environment

  // Cross-module wires: secrets flow from render + vercel module outputs
  // into env-scoped GitHub Actions secrets that deploy.yml reads at run time.
  render_api_key           = var.render_api_key
  render_api_service_id    = module.render.api_service_id
  render_worker_service_id = module.render.worker_service_id
  enable_worker_secret     = var.enable_worker
  vercel_deploy_hook_url   = module.vercel.deploy_hook_url
  database_url             = module.render.database_external_url
}

# =============================================================================
# Outputs
# =============================================================================

output "api_url" {
  value       = module.render.api_url
  description = "Public URL of the Render backend. Already wired into Vercel's NEXT_PUBLIC_SERVER_URL — surfaced here as an operator diagnostic."
}

output "frontend_url" {
  value       = module.vercel.deployment_url
  description = "Public URL of the Vercel frontend (custom domain when set, otherwise the auto-generated *.vercel.app). Already wired into Render's CORS_ORIGIN — surfaced here so operators see it after apply without hunting in the Vercel dashboard."
}
