variable "repository" {
  type        = string
  description = "GitHub repository name (without owner)."
}

variable "environment" {
  type        = string
  description = "Environment identifier, also used as the GitHub Actions environment name."
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment))
    error_message = "environment must be lowercase kebab-case."
  }
}

variable "reviewer_user_ids" {
  type        = list(number)
  description = "GitHub numeric user IDs required to approve deploys to this environment. Leave empty for no gate. Must be non-empty for production."
  default     = []

  # The production guard is enforced in the platform module (where
  # var.environment is visible); keep the module itself permissive so non-prod
  # envs can opt out.
}

variable "secrets" {
  type        = map(string)
  description = "Secrets to write to this GitHub environment (value flows from TF vars)."
  default     = {}
  sensitive   = true
}

variable "variables" {
  type        = map(string)
  description = "Non-secret environment variables to write to this GitHub environment."
  default     = {}
}
