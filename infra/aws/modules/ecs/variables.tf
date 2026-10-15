variable "name" {
  type        = string
  description = "Name prefix, e.g. genesis-staging."
}

variable "region" {
  type = string
}

// =============================================================================
// Networking
// =============================================================================

variable "vpc_id" {
  type = string
}

variable "alb_subnet_ids" {
  type        = list(string)
  description = "Private subnets for the internal ALB."
}

variable "task_subnet_ids" {
  type        = list(string)
  description = "Subnets the Fargate tasks run in (public without NAT, private with NAT)."
}

variable "assign_public_ip" {
  type        = bool
  description = "Must be true when tasks run in public subnets: it is their only route to ECR and the internet."
}

variable "app_security_group_id" {
  type = string
}

variable "alb_security_group_id" {
  type = string
}

variable "origin_header_name" {
  type        = string
  description = "Header CloudFront stamps on each origin request; its value (api | web) selects the target group."
}

variable "container_port" {
  type    = number
  default = 3000
}

// =============================================================================
// Images (tagged per environment by the deploy workflow)
// =============================================================================

variable "api_image" {
  type = string
}

variable "web_image" {
  type = string
}

variable "migrate_image" {
  type = string
}

// =============================================================================
// Sizing
// =============================================================================

variable "api" {
  type = object({
    cpu           = number
    memory        = number
    desired_count = number
    max_count     = number
  })
}

variable "web" {
  type = object({
    cpu           = number
    memory        = number
    desired_count = number
    max_count     = number
  })
}

variable "worker" {
  type = object({
    enabled       = bool
    cpu           = number
    memory        = number
    desired_count = number
  })
}

// =============================================================================
// Runtime configuration
// =============================================================================

variable "api_environment" {
  type        = map(string)
  description = "Plain env vars for the api and worker containers."
}

variable "api_secrets" {
  type        = map(string)
  description = "Env var name → Secrets Manager valueFrom ARN, for the api and worker containers. Must include DATABASE_URL (the migrate task reuses it)."

  validation {
    condition     = contains(keys(var.api_secrets), "DATABASE_URL")
    error_message = "api_secrets must include DATABASE_URL."
  }
}

variable "web_environment" {
  type = map(string)
}

variable "web_secrets" {
  type = map(string)
}

variable "secret_arns" {
  type        = list(string)
  description = "Secrets Manager secrets the execution role may read."
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "container_insights" {
  type    = bool
  default = false
}
