// =============================================================================
// Identity
// =============================================================================

variable "project_name" {
  type = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.project_name))
    error_message = "project_name must be 3-20 chars: lowercase letters, digits, hyphens, starting with a letter."
  }
}

variable "environment" {
  type = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,14}$", var.environment))
    error_message = "environment must be 2-15 chars: lowercase letters, digits, hyphens."
  }
}

variable "region" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "owner/repo whose deploy workflow may assume this environment's deploy role."
}

// =============================================================================
// Network
// =============================================================================

variable "network_mode" {
  type        = string
  default     = "public"
  description = "public: tasks in public subnets with public IPs, no NAT (cheapest). private: tasks in private subnets behind NAT."

  validation {
    condition     = contains(["public", "private"], var.network_mode)
    error_message = "network_mode must be \"public\" or \"private\"."
  }
}

variable "nat_gateway_per_az" {
  type        = bool
  default     = false
  description = "private mode only: one NAT per AZ instead of a single shared NAT."
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

// =============================================================================
// Data stores
// =============================================================================

variable "database" {
  type = object({
    instance_class        = optional(string, "db.t4g.micro")
    allocated_storage     = optional(number, 20)
    multi_az              = optional(bool, false)
    backup_retention_days = optional(number, 7)
  })
  default = {}
}

variable "cache" {
  type = object({
    node_type  = optional(string, "cache.t4g.micro")
    node_count = optional(number, 1)
  })
  default = {}
}

variable "storage_versioning" {
  type    = bool
  default = false
}

variable "deletion_protection" {
  type        = bool
  default     = true
  description = "RDS deletion protection + final snapshot. Set false and apply before destroying the environment."
}

// =============================================================================
// Services (Fargate CPU units / MiB)
// =============================================================================

variable "api" {
  type = object({
    cpu           = optional(number, 256)
    memory        = optional(number, 512)
    desired_count = optional(number, 1)
    max_count     = optional(number, 1)
  })
  default = {}
}

variable "web" {
  type = object({
    cpu           = optional(number, 512)
    memory        = optional(number, 1024)
    desired_count = optional(number, 1)
    max_count     = optional(number, 1)
  })
  default = {}
}

variable "worker" {
  type = object({
    enabled       = optional(bool, false)
    cpu           = optional(number, 256)
    memory        = optional(number, 512)
    desired_count = optional(number, 1)
  })
  default = {}
}

// =============================================================================
// Edge
// =============================================================================

variable "domains" {
  type = object({
    zone_name = string
    web       = string
    api       = string
  })
  default     = null
  description = "Optional custom domains in a Route 53 zone of this account. null serves on *.cloudfront.net."
}

variable "price_class" {
  type    = string
  default = "PriceClass_100"
}

// =============================================================================
// Application configuration
// =============================================================================

variable "app_config" {
  type = object({
    clerk_publishable_key            = string
    resend_from_email                = optional(string, "")
    next_public_rollbar_client_token = optional(string, "")
    next_public_mixpanel_token       = optional(string, "")
    next_public_ga4_measurement_id   = optional(string, "")
  })
  description = "Non-secret app settings. The NEXT_PUBLIC_* values ship to the browser."

  validation {
    condition     = length(var.app_config.clerk_publishable_key) > 0
    error_message = "clerk_publishable_key is required."
  }
}

variable "app_secrets" {
  type = object({
    clerk_secret_key               = string
    resend_api_key                 = optional(string, "")
    rollbar_server_token           = optional(string, "")
    rollbar_client_sourcemap_token = optional(string, "")
  })
  sensitive   = true
  description = "Secret app settings, stored in Secrets Manager."

  validation {
    condition     = length(var.app_secrets.clerk_secret_key) > 0
    error_message = "clerk_secret_key is required."
  }
}

// =============================================================================
// Operations
// =============================================================================

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "secret_recovery_window_days" {
  type        = number
  default     = 7
  description = "Days a deleted secret can be restored. 0 deletes immediately, which lets a torn-down environment be recreated with the same names."
}
