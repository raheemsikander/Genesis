// github module — root resource graph:
//
//   github_repository_environment            (one per deploy target)
//   ├── github_actions_environment_secret    RENDER_API_KEY
//   ├── github_actions_environment_secret    RENDER_API_SERVICE_ID
//   ├── github_actions_environment_secret    RENDER_WORKER_SERVICE_ID  (count = enable_worker_secret ? 1 : 0)
//   ├── github_actions_environment_secret    VERCEL_DEPLOY_HOOK
//   └── github_actions_environment_secret    DATABASE_URL
//
// Why env-scoped (not repo-scoped) secrets: .github/workflows/deploy.yml
// resolves `environment: ${{ github.ref_name == 'main' && 'production' || 'staging' }}`
// at run time, so each environment supplies its own DATABASE_URL,
// RENDER_API_SERVICE_ID, and VERCEL_DEPLOY_HOOK without leakage between
// staging and production runs.
//
// Out of scope: the repo itself, branch protection, repo-level secrets,
// dependabot, Actions allow-list, default branch.

resource "github_repository_environment" "main" {
  repository  = var.github_repo
  environment = var.environment
}

// =============================================================================
// Secrets consumed by .github/workflows/deploy.yml
// =============================================================================

resource "github_actions_environment_secret" "render_api_key" {
  repository  = var.github_repo
  environment = github_repository_environment.main.environment
  secret_name = "RENDER_API_KEY"
  value       = var.render_api_key
}

resource "github_actions_environment_secret" "render_api_service_id" {
  repository  = var.github_repo
  environment = github_repository_environment.main.environment
  secret_name = "RENDER_API_SERVICE_ID"
  value       = var.render_api_service_id
}

// Worker secret is gated on `var.enable_worker_secret` rather than on the
// presence of `var.render_worker_service_id`. The service ID is unknown
// until apply time (Render assigns it), so Terraform can't use it to
// decide `count`. The boolean toggle is known at plan time and lets
// Terraform decide the resource count without needing the apply-time ID.
resource "github_actions_environment_secret" "render_worker_service_id" {
  count = var.enable_worker_secret ? 1 : 0

  repository  = var.github_repo
  environment = github_repository_environment.main.environment
  secret_name = "RENDER_WORKER_SERVICE_ID"
  value       = var.render_worker_service_id
}

resource "github_actions_environment_secret" "vercel_deploy_hook" {
  repository  = var.github_repo
  environment = github_repository_environment.main.environment
  secret_name = "VERCEL_DEPLOY_HOOK"
  value       = var.vercel_deploy_hook_url
}

resource "github_actions_environment_secret" "database_url" {
  repository  = var.github_repo
  environment = github_repository_environment.main.environment
  secret_name = "DATABASE_URL"
  value       = var.database_url
}
