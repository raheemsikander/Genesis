// project_id and deploy_hook_url come from the shared env-root, not this
// module — they're inputs here.

output "deploy_hook_url" {
  value       = var.deploy_hook_url
  sensitive   = true
  description = "Deploy hook URL passed in from shared. Re-exported so the env-root can wire it into GitHub Environment secret VERCEL_DEPLOY_HOOK without reaching back into shared state."
}

output "deployment_url" {
  value       = "https://${vercel_project_domain.main.domain}"
  description = "Public URL for this env (custom domain or auto-generated *.vercel.app, whichever frontend_domain resolved to). Used as CORS_ORIGIN on Render."
}

output "custom_environment_id" {
  value       = local.is_production ? null : vercel_custom_environment.main[0].id
  description = "ID of the custom environment created for non-production envs. `null` for production."
}
