variable "project_name" {
  type = string
}

variable "environment" {
  type        = string
  description = "Also the GitHub Environment name the deploy job runs in."
}

variable "region" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "owner/repo allowed to assume the deploy role."

  validation {
    condition     = can(regex("^[^/]+/[^/]+$", var.github_repository))
    error_message = "github_repository must look like owner/repo."
  }
}

variable "oidc_provider_arn" {
  type = string
}

variable "ecr_repository_arns" {
  type = list(string)
}

variable "cluster_name" {
  type = string
}

variable "cluster_arn" {
  type = string
}

variable "migrate_task_family" {
  type = string
}

variable "migrate_log_group" {
  type = string
}

variable "task_role_arns" {
  type        = list(string)
  description = "Execution + task roles the workflow passes when it runs the migration task."
}

variable "build_secret_arn" {
  type = string
}

variable "deploy_config" {
  type        = any
  description = "Everything the deploy workflow needs (cluster, services, subnets, ECR URLs, web build args). Stored as JSON in SSM."
}
