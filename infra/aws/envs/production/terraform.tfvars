project_name      = "genesis"
environment       = "production"
region            = "us-east-1"
github_repository = "Conrad-Labs/project-genesis-2.0"

# "public": tasks get public IPs, no NAT gateway (cheapest, the default).
# "private": tasks run in private subnets behind NAT. For production, consider
# "private" with nat_gateway_per_az = true (one NAT per AZ, ~$32/mo each).
network_mode = "public"
# nat_gateway_per_az = true

database = {
  instance_class        = "db.t4g.small"
  multi_az              = true
  backup_retention_days = 14
}

# Two nodes = a replica with automatic failover across AZs.
cache = {
  node_type  = "cache.t4g.small"
  node_count = 2
}

api    = { cpu = 512, memory = 1024, desired_count = 2, max_count = 6 }
web    = { cpu = 512, memory = 1024, desired_count = 2, max_count = 6 }
worker = { enabled = false }

deletion_protection = true
storage_versioning  = true
log_retention_days  = 90

# Production Clerk instances require a custom domain.
# domains = {
#   zone_name = "example.com"
#   web       = "app.example.com"
#   api       = "api.example.com"
# }
