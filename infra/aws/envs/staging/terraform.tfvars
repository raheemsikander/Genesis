project_name      = "genesis"
environment       = "staging"
region            = "us-east-1"
github_repository = "Conrad-Labs/project-genesis-2.0"

# "public": tasks get public IPs, no NAT gateway (cheapest, the default).
# "private": tasks run in private subnets behind a NAT gateway (~$32/mo each).
network_mode = "public"

database = {
  instance_class        = "db.t4g.micro"
  multi_az              = false
  backup_retention_days = 1
}

cache = {
  node_type  = "cache.t4g.micro"
  node_count = 1
}

api    = { cpu = 256, memory = 512, desired_count = 1, max_count = 1 }
web    = { cpu = 512, memory = 1024, desired_count = 1, max_count = 1 }
worker = { enabled = false }

# Staging is disposable: no RDS deletion protection, and deleted secrets go
# immediately so a torn-down environment can be recreated under the same names.
deletion_protection         = false
secret_recovery_window_days = 0
log_retention_days          = 14

# Custom domains (Route 53 zone in this account). Leave unset for *.cloudfront.net.
# domains = {
#   zone_name = "example.com"
#   web       = "staging.example.com"
#   api       = "api.staging.example.com"
# }
