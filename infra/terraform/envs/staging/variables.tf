# =============================================================================
# CANONICAL per-env variable schema.
#
# `envs/production/variables.tf` is a symlink to this file — the two env roots
# accept the same shape and only differ in their tfvars values. Edit this file
# and the change applies to every per-env Terraform root (staging, production,
# and any future env created from these instructions). Do NOT copy/edit
# production's variables.tf separately; recreate the symlink if it ever gets
# replaced with a regular file.
#
# If a future env genuinely needs a different schema (e.g. a prod-only var),
# break the symlink for that env: `rm envs/<env>/variables.tf && cp
# envs/staging/variables.tf envs/<env>/variables.tf`, then diverge.
# =============================================================================

# =============================================================================
# Identity & wiring
# =============================================================================

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

# branch and repo_url come from the shared workspace via terraform_remote_state.
# See main.tf's locals block.

variable "region" {
  type    = string
  default = "oregon"
}

# =============================================================================
# Plan tiers & container build
# =============================================================================

variable "postgres_plan" {
  type    = string
  default = "free"
}

variable "redis_plan" {
  type    = string
  default = "free"
}

variable "web_service_plan" {
  type    = string
  default = "free"
}

variable "worker_plan" {
  type    = string
  default = "starter"
}

variable "dockerfile_path" {
  type    = string
  default = "./Dockerfile"
}

variable "docker_context" {
  type    = string
  default = "."
}

variable "health_check_path" {
  type    = string
  default = "/health"
}

variable "worker_command" {
  type    = string
  default = "node apps/server/dist/async-tasks/worker.mjs"
}

variable "enable_worker" {
  type    = bool
  default = false
}

variable "service_enabled" {
  type        = bool
  default     = true
  description = "When false, the web service and worker are not created. Stateful resources (Postgres, Redis, R2, env group) remain intact."
}

# =============================================================================
# App env vars — required (consumed by both Render and Vercel)
# =============================================================================

variable "clerk_secret_key" {
  type      = string
  sensitive = true
}

variable "clerk_publishable_key" {
  type      = string
  sensitive = true
}

# =============================================================================
# App env vars — server-only (flow into the Render web service env group)
# =============================================================================

variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "resend_from_email" {
  type    = string
  default = ""
}

# =============================================================================
# Cloudflare R2 (optional integration — enabled by default)
# =============================================================================

variable "enable_r2" {
  type        = bool
  default     = true
  description = "Provision a Cloudflare R2 bucket. When true, Terraform creates the bucket and injects S3_ENDPOINT / S3_REGION / S3_BUCKET into the Render env group automatically."
}

variable "cloudflare_account_id" {
  type        = string
  default     = ""
  description = "Cloudflare account ID. Required when enable_r2 = true. Set in shared/.envrc as TF_VAR_cloudflare_account_id. Not sensitive — it appears in the public R2 endpoint URL."
}

# R2 runtime credentials — supplied by the operator; never managed by Terraform
# (writing them into state would expose secrets). Create an R2 API token in the
# Cloudflare dashboard under R2 → Manage R2 API tokens and paste here.
variable "s3_public_endpoint" {
  type        = string
  default     = ""
  description = "Public URL clients use to reach storage for presigned GET URLs. Optional: leave empty to use s3_endpoint."
}

variable "s3_access_key_id" {
  type      = string
  sensitive = true
  default   = ""
}

variable "s3_secret_access_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "rollbar_server_token" {
  type      = string
  sensitive = true
  default   = ""
}

# =============================================================================
# App env vars — client-only (flow into the Vercel project env vars)
# =============================================================================

variable "next_public_rollbar_client_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "rollbar_client_sourcemap_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "next_public_mixpanel_token" {
  type      = string
  sensitive = true
  default   = ""
}

# =============================================================================
# Vercel platform options
# =============================================================================

variable "vercel_team_id" {
  type        = string
  default     = null
  description = "Vercel team ID. Provider also reads VERCEL_TEAM_ID from env."
}

variable "frontend_domain" {
  type        = string
  default     = null
  description = "Optional public domain for the frontend — custom domain or *.vercel.app. Leave unset to auto-generate `<project>-<env>-<6-hex>.vercel.app`."
}

# =============================================================================
# GitHub-only (mirror of RENDER_API_KEY for the github module)
# =============================================================================

variable "render_api_key" {
  type        = string
  sensitive   = true
  description = "Render API key — same value as the bare RENDER_API_KEY the render provider reads. Wired into the GitHub Environment as RENDER_API_KEY so deploy.yml can call Render's REST deploy endpoint."

  validation {
    condition     = length(var.render_api_key) > 0
    error_message = "render_api_key must be non-empty (set in .envrc as TF_VAR_render_api_key, mirroring RENDER_API_KEY)."
  }
}
