// =============================================================================
// Identity & wiring
// =============================================================================

variable "project_name" {
  type        = string
  description = "Vercel project name (e.g., \"myproject\"). Used as the resource name and for `next_public_node_env` derivation."
}

variable "environment" {
  type        = string
  description = "Deployment environment — `production` or `staging`. Drives target/custom-env wiring on env vars."

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be one of: staging, production (lowercase). To add a new env, append its name here and to the validators in modules/render/variables.tf and modules/github/variables.tf."
  }
}

variable "branch" {
  type        = string
  description = "Git branch this Vercel environment tracks (`develop`, `main`, etc.). Used for the custom_environment branch_tracking pattern."
}

variable "vercel_team_id" {
  type        = string
  default     = null
  description = "Vercel team ID (`team_...`). Leave unset / null for personal accounts. The provider also reads VERCEL_TEAM_ID from the environment."
}

// =============================================================================
// Wiring from the shared env-root
// =============================================================================

variable "project_id" {
  type        = string
  description = "Vercel project ID. Comes from the shared env-root's `vercel_project_id` output."

  validation {
    condition     = length(var.project_id) > 0
    error_message = "project_id must be non-empty — apply the shared env-root first and read its output via terraform_remote_state."
  }
}

variable "deploy_hook_id" {
  type        = string
  description = "Vercel deploy hook ID for this env. Comes from `vercel_deploy_hooks[<env>].id` in the shared env-root."
}

variable "deploy_hook_url" {
  type        = string
  sensitive   = true
  description = "Vercel deploy hook URL for this env. Comes from `vercel_deploy_hooks[<env>].url` in the shared env-root."
}

// =============================================================================
// App env vars (flow into Vercel project env vars, scoped to this env)
// =============================================================================

variable "next_public_server_url" {
  type        = string
  description = "URL of the Render API for this env (typically wired from module.render.api_url)."

  validation {
    condition     = var.next_public_server_url == "" || can(regex("^https?://", var.next_public_server_url))
    error_message = "next_public_server_url must be a URL (e.g., https://myproject-staging-api.onrender.com) or empty when service_enabled = false."
  }
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true

  validation {
    condition     = length(var.clerk_secret_key) > 0
    error_message = "clerk_secret_key must be non-empty (set in .envrc as TF_VAR_clerk_secret_key)."
  }
}

variable "clerk_publishable_key" {
  type      = string
  sensitive = true

  validation {
    condition     = length(var.clerk_publishable_key) > 0
    error_message = "clerk_publishable_key must be non-empty (set in .envrc as TF_VAR_clerk_publishable_key)."
  }
}

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

// =============================================================================
// Frontend domain
// =============================================================================

variable "frontend_domain" {
  type        = string
  default     = null
  description = "Optional public domain for the frontend — either a custom domain (e.g., staging.myproject.com) or a specific *.vercel.app name. When null, the module auto-generates <project>-<env>-<6hex>.vercel.app (stable across applies, the random suffix lives in state). Whatever value is in effect flows into deployment_url, which the env-root wires into Render's CORS_ORIGIN. Custom (non-vercel.app) domains require a CNAME → cname.vercel-dns.com at your DNS provider; first apply may need a re-run while DNS propagates."
}

// (vercel_authentication_deployment_type, framework, build_command, root_directory,
// install_command, production_branch, repo_url all moved to envs/shared/ since
// they're project-level settings, not env-level.)
