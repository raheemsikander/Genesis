# Provider credentials - supplied via Terraform Cloud workspace variables
# (marked sensitive) or a local terraform.tfvars (gitignored). Never commit values.

variable "render_api_key" {
  type      = string
  sensitive = true
}

variable "vercel_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "github_token" {
  type      = string
  sensitive = true
}

variable "github_owner" {
  type        = string
  description = "GitHub org/user that owns the repo (e.g. \"Conrad-Labs\")."
}

# Platform inputs

variable "app_name" {
  type    = string
  default = "genesis"
}

variable "branch" {
  type        = string
  default     = "main"
  description = "Branch tracked by the production environment."
}

variable "render_owner_id" {
  type = string
}

variable "render_repo_url" {
  type = string
}

variable "vercel_team_id" {
  type = string
}

variable "vercel_git_repo" {
  type = string
}

variable "github_repository" {
  type = string
}

variable "cloudflare_account_id" {
  type    = string
  default = null
}

variable "vercel_domain" {
  type    = string
  default = null
}

# Master switches

variable "enabled" {
  type        = bool
  description = "Master switch for the entire environment. When false, the next apply destroys everything in it. Postgres and R2 are protected by prevent_destroy lifecycle blocks - you'll need to edit those out for a real teardown."
  default     = true
}

variable "service_enabled" {
  type        = bool
  description = "Service-level pause. When false, the Render web service + worker and the Vercel project are destroyed but data-bearing resources (Postgres, Key Value, R2, env group) are preserved. Use to stop serving traffic without losing data."
  default     = true
}

# Feature flags

variable "enable_worker" {
  type    = bool
  default = true
}

variable "enable_r2" {
  type    = bool
  default = true
}

variable "enable_rollbar" {
  type    = bool
  default = false
}

variable "enable_codecov" {
  type    = bool
  default = false
}

# Server pre-deploy command (migrations)

variable "server_pre_deploy_command" {
  type        = string
  description = "Command Render runs before each deploy becomes live. Defaults to applying Drizzle migrations."
  default     = "pnpm --filter @genesis/server db:migrate"
}

# Third-party secrets

variable "clerk_publishable_key" {
  type      = string
  sensitive = true
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
}

variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "resend_from_email" {
  type    = string
  default = ""
}

variable "rollbar_server_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "rollbar_client_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "codecov_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "r2_access_key_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "r2_secret_access_key" {
  type      = string
  sensitive = true
  default   = ""
}
