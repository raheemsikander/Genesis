locals {
  project_name = "${var.app_name}-${var.environment}-web"
}

resource "vercel_project" "web" {
  count = var.enabled ? 1 : 0

  name      = local.project_name
  team_id   = var.team_id
  framework = "nextjs"

  root_directory             = var.root_directory
  serverless_function_region = var.serverless_function_region

  git_repository = {
    type              = "github"
    repo              = var.git_repo
    production_branch = var.production_branch
  }
}

resource "vercel_project_environment_variable" "plain" {
  for_each   = var.enabled ? var.env_vars : {}
  project_id = vercel_project.web[0].id
  team_id    = var.team_id
  key        = each.key
  value      = each.value
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "secret" {
  # Keys (names) are not sensitive, values are. for_each cannot take a sensitive
  # value directly, so iterate over the non-sensitive key set and look up the
  # value by key inside the resource body.
  for_each   = var.enabled ? nonsensitive(toset(keys(var.secret_env_vars))) : toset([])
  project_id = vercel_project.web[0].id
  team_id    = var.team_id
  key        = each.key
  value      = var.secret_env_vars[each.key]
  sensitive  = true
  target     = ["production", "preview", "development"]
}

resource "vercel_project_domain" "custom" {
  count      = var.enabled && var.domain != null ? 1 : 0
  project_id = vercel_project.web[0].id
  team_id    = var.team_id
  domain     = var.domain
}
