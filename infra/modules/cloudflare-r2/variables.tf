variable "enabled" {
  type        = bool
  description = "When false, no Cloudflare resources are created. Use for apps that don't need object storage."
  default     = true
}

variable "app_name" {
  type        = string
  description = "Base app name used as a prefix for the bucket (e.g. \"genesis\")."
}

variable "environment" {
  type        = string
  description = "Environment identifier (lowercase kebab-case)."
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.environment))
    error_message = "environment must be lowercase kebab-case."
  }
}

variable "account_id" {
  type        = string
  description = "Cloudflare account ID."
}

variable "location" {
  type        = string
  description = "R2 jurisdiction / location hint (e.g. \"wnam\", \"enam\", \"weur\")."
  default     = "wnam"
}
