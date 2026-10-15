// =============================================================================
// Identity & wiring
// =============================================================================

variable "project_name" {
  type        = string
  description = "Used only as a naming prefix for env-scoped Render resources (e.g. <project>-<env>-api). The render_project itself is owned by the shared env-root."
}

variable "environment" {
  type = string

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be one of: staging, production (lowercase). To add a new env, append its name here and to the validators in modules/vercel/variables.tf and modules/github/variables.tf."
  }
}

variable "branch" {
  type = string
}

variable "repo_url" {
  type    = string
  default = "https://github.com/example/placeholder"

  validation {
    condition     = length(var.repo_url) > 0
    error_message = "repo_url must be non-empty (set in TFC workspace variables once the repo is connected to Render)."
  }
}

variable "environment_id" {
  type        = string
  description = "Render environment ID for var.environment. Comes from the shared env-root's `render_environment_ids` output, indexed by env name."

  validation {
    condition     = length(var.environment_id) > 0
    error_message = "environment_id must be non-empty — the shared env-root must be applied first, and the per-env root must read it via terraform_remote_state."
  }
}

// =============================================================================
// Plan tiers & region
// =============================================================================

variable "region" {
  type    = string
  default = "oregon"
}

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

// =============================================================================
// Container build & runtime
// =============================================================================

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
  description = "When false, the web service and worker are not created (count=0). Postgres, Redis, R2, and the env group remain intact — use this to pause services without destroying stateful resources."
}

// =============================================================================
// App env vars — required
// =============================================================================

variable "cors_origin" {
  type = string

  validation {
    condition     = length(var.cors_origin) > 0
    error_message = "cors_origin must be non-empty (set the Vercel URL once it exists; placeholder OK during initial bootstrap)."
  }
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true

  validation {
    condition     = length(var.clerk_secret_key) > 0
    error_message = "clerk_secret_key must be non-empty (set in TFC workspace variables, never in tfvars)."
  }
}

variable "clerk_publishable_key" {
  type      = string
  sensitive = true

  validation {
    condition     = length(var.clerk_publishable_key) > 0
    error_message = "clerk_publishable_key must be non-empty (set in TFC workspace variables)."
  }
}

// =============================================================================
// App env vars — Resend
// =============================================================================

variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "resend_from_email" {
  type    = string
  default = ""
}

// =============================================================================
// App env vars — S3-compatible storage
// =============================================================================

variable "s3_endpoint" {
  type    = string
  default = ""
}

variable "s3_public_endpoint" {
  type        = string
  default     = ""
  description = "Public URL clients use to reach storage. Presigned GET URLs are signed against this host. Leave empty to use s3_endpoint."
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

variable "s3_region" {
  type    = string
  default = ""
}

variable "s3_bucket" {
  type    = string
  default = ""
}

// =============================================================================
// App env vars — Rollbar
// =============================================================================

variable "rollbar_server_token" {
  type      = string
  sensitive = true
  default   = ""
}

// =============================================================================
// Postgres external-network IP allowlist
//
// Module default is `[]` (block all). Both env-roots override with
// `[{cidr_block = "0.0.0.0/0"}]` so the local-exec migration step can reach
// Postgres from outside Render's private network — connection is still TLS
// + strong-password protected. See envs/<env>/main.tf for the override.
// =============================================================================

variable "postgres_ip_allow_list" {
  type = list(object({
    cidr_block  = string
    description = string
  }))
  default = []
}
