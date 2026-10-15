// Shared by every environment root (production symlinks here). Sizing and
// shape defaults live in modules/environment/variables.tf; the object-typed
// settings below are passed straight through, so any field left out of
// terraform.tfvars takes the module default.

// =============================================================================
// Identity (terraform.tfvars)
// =============================================================================

variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "owner/repo allowed to deploy this environment from GitHub Actions."
}

// =============================================================================
// Shape and sizing (terraform.tfvars)
// =============================================================================

variable "network_mode" {
  type    = string
  default = "public"
}

variable "nat_gateway_per_az" {
  type    = bool
  default = false
}

variable "database" {
  type    = any
  default = {}
}

variable "cache" {
  type    = any
  default = {}
}

variable "storage_versioning" {
  type    = bool
  default = false
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "api" {
  type    = any
  default = {}
}

variable "web" {
  type    = any
  default = {}
}

variable "worker" {
  type    = any
  default = {}
}

variable "domains" {
  type    = any
  default = null
}

variable "price_class" {
  type    = string
  default = "PriceClass_100"
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "secret_recovery_window_days" {
  type    = number
  default = 7
}

// =============================================================================
// App settings (.envrc as TF_VAR_*)
// =============================================================================

variable "clerk_publishable_key" {
  type = string
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
}

variable "resend_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "resend_from_email" {
  type    = string
  default = ""
}

variable "rollbar_server_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "next_public_rollbar_client_token" {
  type    = string
  default = ""
}

variable "rollbar_client_sourcemap_token" {
  type      = string
  sensitive = true
  default   = ""
}

variable "next_public_mixpanel_token" {
  type    = string
  default = ""
}

variable "next_public_ga4_measurement_id" {
  type    = string
  default = ""
}
