resource "github_repository_environment" "env" {
  repository  = var.repository
  environment = var.environment

  dynamic "reviewers" {
    for_each = length(var.reviewer_user_ids) > 0 ? [1] : []
    content {
      users = var.reviewer_user_ids
    }
  }

  # Production: only protected branches (e.g. main) can deploy.
  # qa/staging: no branch block is configured at all, so any branch can deploy.
  dynamic "deployment_branch_policy" {
    for_each = var.environment == "production" ? [1] : []
    content {
      protected_branches     = true
      custom_branch_policies = false
    }
  }
}

resource "github_actions_environment_secret" "secrets" {
  # Secret names are not sensitive; values are. Iterate over the non-sensitive
  # key set and look up each value inside the resource.
  for_each        = nonsensitive(toset(keys(var.secrets)))
  repository      = var.repository
  environment     = github_repository_environment.env.environment
  secret_name     = each.key
  plaintext_value = var.secrets[each.key]
}

resource "github_actions_environment_variable" "variables" {
  for_each      = var.variables
  repository    = var.repository
  environment   = github_repository_environment.env.environment
  variable_name = each.key
  value         = each.value
}
