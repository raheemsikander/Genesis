// =============================================================================
// Shared infrastructure — the Vercel project and Render project that span
// every environment. Apply this workspace once before staging or production.
// Per-env roots read these IDs and deploy-hook URLs via terraform_remote_state.
//
// Prereqs (covered in docs/setup/STAGING.md):
//   - Render GitHub App installed on the org with access to the repo.
//   - Vercel GitHub App installed on the org with access to the repo.
//   - Render API key + owner ID, Vercel API token, GitHub PAT — all in .envrc.
// =============================================================================

locals {
  // Parse "https://github.com/<owner>/<repo>" → "<owner>/<repo>"
  repo_path = trimsuffix(replace(var.repo_url, "https://github.com/", ""), "/")

  // Vercel provider normalizes empty string to null on read. Coerce up front
  // so subsequent applies don't see a phantom diff.
  team_id = var.vercel_team_id == "" ? null : var.vercel_team_id

  // Vercel's production environment maps to a single branch on the project.
  production_branch = var.environments["production"].branch
}

# =============================================================================
# Render project — one project, one environment per entry in var.environments.
# =============================================================================

resource "render_project" "main" {
  name = var.project_name

  environments = {
    for k, v in var.environments : k => {
      name             = k
      protected_status = v.protected_status
    }
  }
}

# =============================================================================
# Vercel project — single project with one deploy hook per env. Vercel's
# built-in "production" environment is always present; non-prod envs attach
# via vercel_custom_environment in each per-env root.
# =============================================================================

resource "vercel_project" "main" {
  name      = var.project_name
  framework = var.framework
  team_id   = local.team_id

  git_repository = {
    type              = "github"
    repo              = local.repo_path
    production_branch = local.production_branch

    // One deploy hook per environment. Per-env roots look up "their" hook
    // by name from this set and POST to its URL on env-var changes.
    deploy_hooks = [
      for k, v in var.environments : {
        name = k
        ref  = v.branch
      }
    ]
  }

  root_directory = var.root_directory
  // Empty build_command → null so Vercel falls back to apps/web/vercel.json's
  // `buildCommand` (or framework default), instead of treating "" as an
  // explicit empty command.
  build_command   = var.build_command == "" ? null : var.build_command
  install_command = var.install_command

  // Auto-deploy on git push is disabled — env-roots fire deploy hooks via the
  // REST API after Render-side migrations succeed.
  git_comments = {
    on_pull_request = false
    on_commit       = false
  }

  vercel_authentication = {
    deployment_type = var.vercel_authentication_deployment_type
  }
}
