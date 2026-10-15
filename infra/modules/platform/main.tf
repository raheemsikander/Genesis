# Cross-variable validations. Each precondition pairs an enable_* flag with
# its required inputs so plan/apply fails with a clear message at the input
# boundary rather than deep inside a provider call.
resource "terraform_data" "validate_inputs" {
  lifecycle {
    precondition {
      condition     = !var.enable_r2 || var.cloudflare_account_id != null
      error_message = "cloudflare_account_id is required when enable_r2 = true."
    }
    precondition {
      condition     = !var.enable_r2 || (var.r2_access_key_id != "" && var.r2_secret_access_key != "")
      error_message = "r2_access_key_id and r2_secret_access_key are required when enable_r2 = true."
    }
    precondition {
      condition     = !var.enable_rollbar || (var.rollbar_server_token != "" && var.rollbar_client_token != "")
      error_message = "rollbar_server_token and rollbar_client_token are required when enable_rollbar = true."
    }
    precondition {
      condition     = !var.enable_codecov || var.codecov_token != ""
      error_message = "codecov_token is required when enable_codecov = true."
    }
    precondition {
      condition     = var.environment != "production" || length(var.github_reviewer_user_ids) > 0
      error_message = "github_reviewer_user_ids must contain at least one GitHub user ID for the production environment."
    }
  }
}

locals {
  # Vercel project names are deterministic from app_name + environment. The
  # hostname for the Vercel-managed default URL follows the same pattern.
  # Using this computed value (instead of module.vercel.default_url) keeps
  # CORS_ORIGIN stable across service_enabled flips, so the env group never
  # contains an empty string that would fail z.url() when the service is
  # re-enabled.
  vercel_project_name     = "${var.app_name}-${var.environment}-web"
  vercel_default_hostname = "${local.vercel_project_name}.vercel.app"

  # Web origin used by the backend's CORS allowlist. Custom domain wins; else
  # the deterministic Vercel-managed hostname.
  web_origin = var.vercel_domain != null ? "https://${var.vercel_domain}" : "https://${local.vercel_default_hostname}"

  # Backend (server) env vars, non-secrets.
  server_env_vars = merge(
    {
      NODE_ENV              = "production"
      LOG_LEVEL             = "info"
      CORS_ORIGIN           = local.web_origin
      CLERK_PUBLISHABLE_KEY = var.clerk_publishable_key
      RESEND_FROM_EMAIL     = var.resend_from_email
    },
    var.enable_r2 ? {
      S3_BUCKET   = module.r2.bucket_name
      S3_ENDPOINT = module.r2.s3_endpoint
      S3_REGION   = "auto"
    } : {},
  )

  # Backend secrets
  server_secret_env_vars = merge(
    {
      CLERK_SECRET_KEY = var.clerk_secret_key
    },
    var.resend_api_key != "" ? { RESEND_API_KEY = var.resend_api_key } : {},
    var.enable_rollbar ? { ROLLBAR_SERVER_TOKEN = var.rollbar_server_token } : {},
    var.enable_r2 ? {
      S3_ACCESS_KEY_ID     = var.r2_access_key_id
      S3_SECRET_ACCESS_KEY = var.r2_secret_access_key
    } : {},
  )

  # Frontend (Next.js) non-secret env vars. Only populated when the Vercel
  # project is enabled - when paused, no env var resources are instantiated.
  web_env_vars = var.service_enabled ? merge(
    {
      NEXT_PUBLIC_SERVER_URL            = module.render.server_url
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = var.clerk_publishable_key
      NEXT_PUBLIC_CLERK_SIGN_IN_URL     = var.clerk_sign_in_url
      NEXT_PUBLIC_CLERK_SIGN_UP_URL     = var.clerk_sign_up_url
      NEXT_PUBLIC_NODE_ENV              = "production"
    },
  ) : {}

  # Frontend secrets. Kept separate from web_env_vars so sensitive values never
  # flow through a non-sensitive map(string).
  web_secret_env_vars = var.service_enabled ? merge(
    var.enable_rollbar ? { NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN = var.rollbar_client_token } : {},
  ) : {}

  # GitHub secrets / variables - drop Render/Vercel IDs when services paused.
  github_secrets = merge(
    var.service_enabled ? {
      RENDER_SERVER_SERVICE_ID = module.render.server_service_id
      VERCEL_PROJECT_ID        = module.vercel.project_id
    } : {},
    var.service_enabled && var.enable_worker ? {
      RENDER_WORKER_SERVICE_ID = module.render.worker_service_id
    } : {},
    var.enable_codecov ? { CODECOV_TOKEN = var.codecov_token } : {},
  )

  github_variables = merge(
    {
      APP_ENVIRONMENT = var.environment
    },
    var.service_enabled ? {
      SERVER_URL = module.render.server_url
      WEB_URL    = module.vercel.default_url
    } : {},
  )
}

module "render" {
  source = "../render"

  app_name    = var.app_name
  environment = var.environment
  region      = var.render_region
  repo_url    = var.render_repo_url
  branch      = var.branch

  server_plan    = var.render_server_plan
  worker_plan    = var.render_worker_plan
  postgres_plan  = var.render_postgres_plan
  key_value_plan = var.render_key_value_plan

  service_enabled = var.service_enabled
  enable_worker   = var.enable_worker

  server_pre_deploy_command = var.server_pre_deploy_command

  env_vars        = local.server_env_vars
  secret_env_vars = local.server_secret_env_vars
}

module "r2" {
  source = "../cloudflare-r2"

  enabled     = var.enable_r2
  app_name    = var.app_name
  environment = var.environment
  account_id  = var.cloudflare_account_id
  location    = var.cloudflare_r2_location
}

module "vercel" {
  source = "../vercel"

  enabled                    = var.service_enabled
  app_name                   = var.app_name
  environment                = var.environment
  team_id                    = var.vercel_team_id
  git_repo                   = var.vercel_git_repo
  production_branch          = var.branch
  domain                     = var.vercel_domain
  serverless_function_region = var.vercel_serverless_function_region

  env_vars        = local.web_env_vars
  secret_env_vars = local.web_secret_env_vars
}

module "github" {
  source = "../github"

  repository        = var.github_repository
  environment       = var.environment
  reviewer_user_ids = var.github_reviewer_user_ids

  secrets   = local.github_secrets
  variables = local.github_variables
}
