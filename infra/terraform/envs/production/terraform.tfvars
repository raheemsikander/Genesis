project_name     = "genesis"
environment      = "production"
region           = "oregon"
postgres_plan    = "basic_256mb"
redis_plan       = "starter"
web_service_plan = "starter"
worker_plan      = "starter"
enable_worker    = false
service_enabled  = true
enable_r2        = true

# project_name + repo_url + branch (per env) live in envs/shared/terraform.tfvars
# and are read here via terraform_remote_state. Sensitive values (Clerk live
# keys, Resend, R2, Rollbar, render_api_key mirror) come from .envrc as
# TF_VAR_* exports. Use *_live_* Clerk keys here, not *_test_*.
