variable "app_name" {
  type        = string
  description = "Base app name used as a prefix for all Render resources (e.g. \"genesis\")."
}

variable "environment" {
  type        = string
  description = "Environment identifier, e.g. \"staging\" or \"production\". Must be lowercase kebab-case so it is safe to use in resource names."
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment))
    error_message = "environment must be lowercase kebab-case (matching ^[a-z][a-z0-9-]*$)."
  }
}

variable "region" {
  type        = string
  description = "Render region (e.g. \"oregon\", \"frankfurt\", \"singapore\")."
  default     = "oregon"
}

# Render v1.8 scopes all resources under a project, not an owner_id. The
# owner_id is implied by the API token used by the provider.

variable "repo_url" {
  type        = string
  description = "GitHub repo URL that Render pulls from."
}

variable "branch" {
  type        = string
  description = "Git branch this environment tracks (e.g. develop, main)."
}

variable "server_plan" {
  type        = string
  description = "Render instance plan for the backend web service."
  default     = "starter"
}

variable "postgres_plan" {
  type        = string
  description = "Render Postgres plan."
  default     = "basic_256mb"
}

variable "key_value_plan" {
  type        = string
  description = "Render Key Value (Redis) plan."
  default     = "free"
}

variable "worker_plan" {
  type        = string
  description = "Render worker plan (ignored when enable_worker = false)."
  default     = "starter"
}

variable "enable_worker" {
  type        = bool
  description = "Provision the BullMQ background worker service."
  default     = true
}

variable "service_enabled" {
  type        = bool
  description = "Service-level pause. When false, the backend web service and worker are destroyed but Postgres, Key Value, and the env group are preserved (data layer stays intact, app stops serving traffic)."
  default     = true
}

variable "server_build_command" {
  type        = string
  description = "Build command for the backend service."
  default     = "pnpm install --frozen-lockfile && pnpm --filter @genesis/server build"
}

variable "server_start_command" {
  type        = string
  description = "Start command for the backend service."
  default     = "pnpm --filter @genesis/server start"
}

variable "server_port" {
  type        = string
  description = "Port the backend HTTP server binds to inside the Render container. Render's public URL forwards to this port."
  default     = "10000"
}

variable "server_pre_deploy_command" {
  type        = string
  description = "Command run by Render before each deploy becomes live. Used to apply database migrations. If this fails, the new version does not receive traffic and the previous version keeps serving. Set to empty string to skip."
  default     = "pnpm --filter @genesis/server db:migrate"
}

variable "worker_start_command" {
  type        = string
  description = "Start command for the worker service."
  default     = "pnpm --filter @genesis/server start:worker"
}

variable "env_vars" {
  type        = map(string)
  description = "Non-secret env vars applied to the backend and worker."
  default     = {}
}

variable "secret_env_vars" {
  type        = map(string)
  description = "Secret env vars applied to the backend and worker (marked sensitive)."
  default     = {}
  sensitive   = true
}
