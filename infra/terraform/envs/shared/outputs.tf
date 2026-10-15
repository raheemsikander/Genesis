// Outputs consumed by per-env roots via `terraform_remote_state`.
//
// The per-env modules accept `project_id` (Render or Vercel) and either
// `environment_id` (Render) or `deploy_hook_url` (Vercel) so they can
// hang env-scoped resources off the shared parent.

output "render_project_id" {
  value       = render_project.main.id
  description = "Render project ID. Per-env roots pass this into the render module."
}

output "render_environment_ids" {
  value = {
    for k, v in render_project.main.environments : k => v.id
  }
  description = "Map of environment name → Render environment ID. Per-env roots index this by var.environment."
}

output "vercel_project_id" {
  value       = vercel_project.main.id
  description = "Vercel project ID. Per-env roots pass this into the vercel module."
}

output "vercel_deploy_hooks" {
  value = {
    for h in vercel_project.main.git_repository.deploy_hooks : h.name => {
      id  = h.id
      url = h.url
    }
  }
  sensitive   = true
  description = "Map of env name → {id, url} for the Vercel deploy hook. Per-env roots index by var.environment to fetch their hook."
}

output "repo_url" {
  value       = var.repo_url
  description = "Re-exported so per-env roots have one source of truth for the repo (Render web service runtime_source needs it)."
}

output "branches" {
  value = {
    for k, v in var.environments : k => v.branch
  }
  description = "Map of env name → branch. Per-env roots use this for the Render web service's branch field, matching the Vercel deploy hook's ref."
}
