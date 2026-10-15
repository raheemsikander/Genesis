variable "name" {
  type        = string
  description = "Name prefix for every network resource (e.g. genesis-staging)."
}

variable "cidr_block" {
  type        = string
  default     = "10.0.0.0/16"
  description = "VPC CIDR. Must be a /16: subnets are carved as /20s."

  validation {
    condition     = can(cidrnetmask(var.cidr_block)) && endswith(var.cidr_block, "/16")
    error_message = "cidr_block must be a valid /16 CIDR (e.g. 10.0.0.0/16)."
  }
}

variable "az_count" {
  type        = number
  default     = 2
  description = "Number of availability zones to span. RDS and the ALB need at least 2."

  validation {
    condition     = var.az_count >= 2 && var.az_count <= 3
    error_message = "az_count must be 2 or 3."
  }
}

variable "enable_nat" {
  type        = bool
  default     = false
  description = "Create NAT gateway(s) so ECS tasks can run in private subnets."
}

variable "nat_gateway_per_az" {
  type        = bool
  default     = false
  description = "One NAT per AZ (survives an AZ outage) instead of a single shared NAT. Only used when enable_nat = true."
}
