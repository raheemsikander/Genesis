variable "name" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_ids" {
  type = list(string)
}

variable "allowed_security_group_ids" {
  type        = list(string)
  description = "Security groups allowed to connect on 6379 (the ECS app tasks)."
}

variable "node_type" {
  type    = string
  default = "cache.t4g.micro"
}

variable "node_count" {
  type        = number
  default     = 1
  description = "1 = single node. 2+ adds replicas with automatic failover across AZs."

  validation {
    condition     = var.node_count >= 1 && var.node_count <= 6
    error_message = "node_count must be between 1 and 6."
  }
}

variable "snapshot_retention_days" {
  type    = number
  default = 0
}
