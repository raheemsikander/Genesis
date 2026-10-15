variable "enabled" {
  type        = bool
  description = "When false, no Vercel resources are created (used by the service-level pause flow)."
  default     = true
}

variable "app_name" {
  type        = string
  description = "Base app name used as a prefix for the Vercel project (e.g. \"genesis\")."
}

variable "environment" {
  type        = string
  description = "Environment identifier: \"qa\", \"staging\", or \"production\"."
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment))
    error_message = "environment must be lowercase kebab-case."
  }
}

variable "team_id" {
  type        = string
  description = "Vercel team ID that owns the project."
}

variable "git_repo" {
  type        = string
  description = "GitHub slug in the form \"owner/repo\" (e.g. \"Conrad-Labs/project-genesis-2.0\")."
}

variable "production_branch" {
  type        = string
  description = "Git branch Vercel treats as the project's production deployment for this environment."
}

variable "root_directory" {
  type        = string
  description = "Monorepo root directory for the Next.js app."
  default     = "apps/web"
}

variable "serverless_function_region" {
  type        = string
  description = "Vercel region for serverless functions. Keep this close to the Render region for latency (e.g. Render oregon -> Vercel pdx1 or sfo1; Render frankfurt -> Vercel fra1)."
  default     = "iad1"
}

variable "domain" {
  type        = string
  description = "Custom domain to attach to this Vercel project (null to skip)."
  default     = null
}

variable "env_vars" {
  type        = map(string)
  description = "Non-secret env vars exposed to the Next.js app."
  default     = {}
}

variable "secret_env_vars" {
  type        = map(string)
  description = "Secret env vars exposed to the Next.js app."
  default     = {}
  sensitive   = true
}
