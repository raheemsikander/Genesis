// =============================================================================
// Repo identity
// =============================================================================

variable "github_owner" {
  type        = string
  description = "GitHub org or user that owns the repo (e.g., \"myorg\")."

  validation {
    condition     = length(var.github_owner) > 0
    error_message = "github_owner must be non-empty."
  }
}

variable "github_repo" {
  type        = string
  description = "GitHub repo name (e.g., \"myrepo\"). Just the repo name, not the full URL."

  validation {
    condition     = length(var.github_repo) > 0
    error_message = "github_repo must be non-empty."
  }
}

variable "environment" {
  type        = string
  description = "Deployment environment (drives the GitHub Environment name — `staging`, `production`, etc.). Must match the workflow's `environment:` mapping in .github/workflows/deploy.yml."

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be one of: staging, production (lowercase). To add a new env, append its name here and to the validators in modules/render/variables.tf and modules/vercel/variables.tf."
  }
}

// =============================================================================
// Secrets the deploy.yml workflow expects (env-scoped, not repo-scoped)
// =============================================================================

variable "render_api_key" {
  type        = string
  sensitive   = true
  description = "Render API key. Wired into the GitHub Environment as RENDER_API_KEY so the workflow can POST to Render's deploy endpoint. Same value as the .envrc RENDER_API_KEY (which the render provider reads directly)."

  validation {
    condition     = length(var.render_api_key) > 0
    error_message = "render_api_key must be non-empty (set in .envrc as TF_VAR_render_api_key, mirroring RENDER_API_KEY)."
  }
}

variable "render_api_service_id" {
  type        = string
  description = "ID of the Render web service (e.g., `srv-...`). Wired in as RENDER_API_SERVICE_ID; consumed by deploy.yml to POST to /v1/services/{id}/deploys."

  validation {
    condition     = var.render_api_service_id == "" || can(regex("^srv-[a-z0-9]+$", var.render_api_service_id))
    error_message = "render_api_service_id must be a Render service ID (e.g., `srv-abc123`) or empty when service_enabled = false."
  }
}

variable "render_worker_service_id" {
  type        = string
  default     = null
  description = "ID of the Render background worker service. Used as the value of the RENDER_WORKER_SERVICE_ID secret when `enable_worker_secret` is true. May be null when the worker is disabled."
}

variable "enable_worker_secret" {
  type        = bool
  default     = false
  description = "Whether to create the RENDER_WORKER_SERVICE_ID GitHub Environment secret. Drive this from `var.enable_worker` at the env-root so the secret is in sync with the worker's existence. Must be a plan-time boolean — the worker service ID itself is only known after apply, so we can't gate on it."
}

variable "vercel_deploy_hook_url" {
  type        = string
  sensitive   = true
  description = "Vercel deploy hook URL for this env. Wired in as VERCEL_DEPLOY_HOOK; the workflow POSTs to it after migrations finish. Embedded auth — anyone with the URL can trigger a deploy."

  validation {
    condition     = length(var.vercel_deploy_hook_url) > 0
    error_message = "vercel_deploy_hook_url must be non-empty (typically wired from module.vercel.deploy_hook_url)."
  }
}

variable "database_url" {
  type        = string
  sensitive   = true
  description = "External Postgres connection string with `?sslmode=require`. Wired in as DATABASE_URL; consumed by the migration step in deploy.yml (runs from a GitHub Actions runner, not Render's internal network — must use the external URL)."

  validation {
    condition     = length(var.database_url) > 0
    error_message = "database_url must be non-empty (typically wired from module.render.database_external_url)."
  }
}
