// =============================================================================
// Cross-environment shared infrastructure variables.
//
// Shared resources (the Vercel project, the Render project) live here once
// and are referenced by per-env roots (staging, production, ...) via
// `terraform_remote_state`. Per-env roots own only the resources that vary
// per environment: env vars, services, deploy triggers, GitHub secrets.
// =============================================================================

variable "project_name" {
  type        = string
  description = "Slug used as the name of the Vercel and Render projects."

  validation {
    condition     = length(var.project_name) > 0
    error_message = "project_name must be non-empty."
  }
}

variable "repo_url" {
  type        = string
  description = "GitHub repository URL the Vercel project tracks. Format: https://github.com/<owner>/<repo>"

  validation {
    condition     = can(regex("^https://github\\.com/[^/]+/[^/]+/?$", var.repo_url))
    error_message = "repo_url must be of the form https://github.com/<owner>/<repo>."
  }
}

variable "environments" {
  type = map(object({
    branch           = string
    protected_status = optional(string, "unprotected")
  }))
  description = "Map of environment name → {branch, protected_status}. Each entry produces a Render environment + a Vercel deploy hook. The production branch is also promoted to Vercel's production_branch."
  default = {
    staging = {
      branch           = "develop"
      protected_status = "unprotected"
    }
    production = {
      branch           = "main"
      protected_status = "protected"
    }
  }

  validation {
    condition     = contains(keys(var.environments), "production")
    error_message = "environments must include a 'production' entry — Vercel's production environment maps to it."
  }
}

variable "vercel_team_id" {
  type        = string
  default     = ""
  description = "Vercel team ID (`team_...`) when provisioning under a team. Empty for personal accounts. Sourced from TF_VAR_vercel_team_id in .envrc."
}

variable "framework" {
  type        = string
  default     = "nextjs"
  description = "Vercel framework preset for the project."
}

variable "root_directory" {
  type        = string
  default     = "apps/web"
  description = "Path within the repo Vercel treats as the project root."
}

variable "build_command" {
  type        = string
  default     = ""
  description = "Vercel build command (runs from root_directory). Leave empty to let apps/web/vercel.json's `buildCommand` win — that's the canonical setting."
}

variable "install_command" {
  type        = string
  default     = "pnpm install --frozen-lockfile"
  description = "Vercel install command (runs from root_directory). pnpm walks up to pnpm-workspace.yaml and hydrates the whole workspace. Vercel's framework detection runs after install, so `next` must be resolvable here."
}

variable "vercel_authentication_deployment_type" {
  type        = string
  default     = "none"
  description = "Whether Vercel SSO gates non-production deployments. `none` keeps preview URLs publicly reachable. `standard_protection` forces Vercel login."
}
