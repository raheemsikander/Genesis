// Preflight module — env-var sanity checks evaluated at `terraform plan` time
// so missing operator secrets fail before any resource is created or destroyed.
// The module owns no real resources; it carries a single `terraform_data` with
// lifecycle preconditions. Add a new precondition to extend the check set.

variable "environment" {
  type        = string
  description = "Deployment environment slug (e.g. \"staging\", \"production\"). Used only to make error messages point at the right .envrc."
}

variable "clerk_secret_key" {
  type      = string
  sensitive = true
}

variable "clerk_publishable_key" {
  type      = string
  sensitive = true
}

variable "enable_r2" {
  type = bool
}

variable "cloudflare_account_id" {
  type = string
}

variable "s3_access_key_id" {
  type      = string
  sensitive = true
}

variable "s3_secret_access_key" {
  type      = string
  sensitive = true
}
