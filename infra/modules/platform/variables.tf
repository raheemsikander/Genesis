variable "app_name" {
  type        = string
  description = "Base app name (e.g. \"genesis\")."
}

variable "environment" {
  type        = string
  description = "Environment identifier, e.g. \"staging\" or \"production\". Must be lowercase kebab-case."
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment))
    error_message = "environment must be lowercase kebab-case (matching ^[a-z][a-z0-9-]*$)."
  }
}

variable "branch" {
  type        = string
  description = "Git branch this environment tracks."
}

# ---------------------------------------------------------------------------
# Skip flags
# ---------------------------------------------------------------------------

variable "service_enabled" {
  type        = bool
  description = "Service-level pause. When false, the Render web service + worker and the Vercel project are destroyed, but data-bearing resources (Postgres, Key Value, R2, env group) are preserved. Use to stop serving traffic without losing data."
  default     = true
}

variable "enable_worker" {
  type        = bool
  description = "Provision the BullMQ background worker on Render."
  default     = true
}

variable "enable_r2" {
  type        = bool
  description = "Provision a Cloudflare R2 bucket for object storage."
  default     = true
}

variable "enable_rollbar" {
  type        = bool
  description = "Wire Rollbar tokens into Render + Vercel env vars. Rollbar project/tokens are created manually."
  default     = false
}

variable "enable_codecov" {
  type        = bool
  description = "Write the Codecov upload token to GitHub Actions secrets."
  default     = false
}

# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

variable "render_region" {
  type        = string
  default     = "oregon"
  description = "Render region."
}

variable "render_repo_url" {
  type        = string
  description = "GitHub repo URL Render pulls from (e.g. https://github.com/Conrad-Labs/project-genesis-2.0)."
}

variable "render_server_plan" {
  type    = string
  default = "starter"
}

variable "render_worker_plan" {
  type    = string
  default = "starter"
}

variable "render_postgres_plan" {
  type    = string
  default = "basic_256mb"
}

variable "render_key_value_plan" {
  type    = string
  default = "free"
}

variable "server_pre_deploy_command" {
  type        = string
  description = "Command Render runs before each deploy becomes live. Defaults to applying Drizzle migrations. Set to empty string to skip."
  default     = "pnpm --filter @genesis/server db:migrate"
}

# ---------------------------------------------------------------------------
# Vercel
# ---------------------------------------------------------------------------

variable "vercel_team_id" {
  type        = string
  description = "Vercel team ID."
}

variable "vercel_git_repo" {
  type        = string
  description = "GitHub slug (owner/repo) for the Vercel Git integration."
}

variable "vercel_domain" {
  type        = string
  description = "Custom domain for this environment (null to skip)."
  default     = null
}

variable "vercel_serverless_function_region" {
  type        = string
  description = "Vercel region for serverless functions. Should be near the Render region for low latency."
  default     = "iad1"
}

# ---------------------------------------------------------------------------
# Cloudflare
# ---------------------------------------------------------------------------

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID. Required when enable_r2 = true."
  default     = null
}

variable "cloudflare_r2_location" {
  type        = string
  default     = "wnam"
  description = "R2 jurisdiction / location hint."
}

# ---------------------------------------------------------------------------
# Third-party secrets (manually created, wired by Terraform)
# ---------------------------------------------------------------------------

variable "clerk_publishable_key" {
  type        = string
  description = "Clerk publishable key (manually obtained from Clerk dashboard)."
  sensitive   = true
}

variable "clerk_secret_key" {
  type        = string
  description = "Clerk secret key."
  sensitive   = true
}

variable "clerk_sign_in_url" {
  type    = string
  default = "/sign-in"
}

variable "clerk_sign_up_url" {
  type    = string
  default = "/sign-up"
}

variable "resend_api_key" {
  type        = string
  description = "Resend API key (manually obtained from Resend dashboard)."
  sensitive   = true
  default     = ""
}

variable "resend_from_email" {
  type    = string
  default = ""
}

variable "rollbar_server_token" {
  type        = string
  description = "Rollbar post_server_item token. Required when enable_rollbar = true."
  sensitive   = true
  default     = ""
}

variable "rollbar_client_token" {
  type        = string
  description = "Rollbar post_client_item token. Required when enable_rollbar = true."
  sensitive   = true
  default     = ""
}

variable "codecov_token" {
  type        = string
  description = "Codecov upload token. Required when enable_codecov = true."
  sensitive   = true
  default     = ""
}

variable "r2_access_key_id" {
  type        = string
  description = "R2 S3-compatible access key ID (created manually in Cloudflare dashboard - one-time step)."
  sensitive   = true
  default     = ""
}

variable "r2_secret_access_key" {
  type        = string
  description = "R2 S3-compatible secret access key."
  sensitive   = true
  default     = ""
}

# ---------------------------------------------------------------------------
# GitHub
# ---------------------------------------------------------------------------

variable "github_repository" {
  type        = string
  description = "GitHub repository name (without owner) for GitHub Actions environment wiring."
}

variable "github_reviewer_user_ids" {
  type        = list(number)
  description = "GitHub user IDs required to approve deploys (e.g. production)."
  default     = []
}

