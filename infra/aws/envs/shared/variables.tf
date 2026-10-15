variable "project_name" {
  type = string
}

variable "region" {
  type = string
}

variable "create_github_oidc_provider" {
  type        = bool
  default     = true
  description = "Create the token.actions.githubusercontent.com OIDC provider. false if the account already has one."
}

variable "images_to_keep" {
  type        = number
  default     = 30
  description = "Images retained per repository (shared by every environment)."
}

variable "environment_tags" {
  type        = list(string)
  default     = ["staging", "production"]
  description = "Environment names; their image tags are exempt from ECR expiry. Add any new environment here."
}
