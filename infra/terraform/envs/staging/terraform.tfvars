project_name     = "genesis"
environment      = "staging"
region           = "oregon"
postgres_plan    = "free"
redis_plan       = "free"
web_service_plan = "free"
worker_plan      = "starter"
enable_worker    = false
service_enabled  = true
enable_r2        = true

# project_name + repo_url + branch (per env) live in envs/shared/terraform.tfvars
# and are read here via terraform_remote_state. Sensitive values (Clerk, Resend,
# R2, Rollbar, render_api_key mirror) come from .envrc as TF_VAR_* exports.
# See .envrc.example for the full list.
