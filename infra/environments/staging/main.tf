provider "render" {
  api_key  = var.render_api_key
  owner_id = var.render_owner_id
}

provider "vercel" {
  api_token = var.vercel_api_token
  team      = var.vercel_team_id
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

provider "github" {
  token = var.github_token
  owner = var.github_owner
}

module "platform" {
  source = "../../modules/platform"
  count  = var.enabled ? 1 : 0

  app_name    = var.app_name
  environment = "staging"
  branch      = var.branch

  service_enabled = var.service_enabled
  enable_worker   = var.enable_worker
  enable_r2       = var.enable_r2
  enable_rollbar  = var.enable_rollbar
  enable_codecov  = var.enable_codecov

  render_repo_url           = var.render_repo_url
  server_pre_deploy_command = var.server_pre_deploy_command

  vercel_team_id  = var.vercel_team_id
  vercel_git_repo = var.vercel_git_repo
  vercel_domain   = var.vercel_domain

  cloudflare_account_id = var.cloudflare_account_id

  clerk_publishable_key = var.clerk_publishable_key
  clerk_secret_key      = var.clerk_secret_key

  resend_api_key    = var.resend_api_key
  resend_from_email = var.resend_from_email

  rollbar_server_token = var.rollbar_server_token
  rollbar_client_token = var.rollbar_client_token

  codecov_token = var.codecov_token

  r2_access_key_id     = var.r2_access_key_id
  r2_secret_access_key = var.r2_secret_access_key

  github_repository = var.github_repository
}

output "server_url" {
  value = var.enabled ? module.platform[0].server_url : null
}

output "web_url" {
  value = var.enabled ? module.platform[0].web_url : null
}

output "github_environment" {
  value = var.enabled ? module.platform[0].github_environment : null
}

output "r2_bucket" {
  value = var.enabled ? module.platform[0].r2_bucket : null
}
