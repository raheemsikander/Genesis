output "project_id" {
  description = "Vercel project ID, or null when disabled."
  value       = var.enabled ? vercel_project.web[0].id : null
}

output "project_name" {
  description = "Vercel project name, or null when disabled."
  value       = var.enabled ? vercel_project.web[0].name : null
}

output "default_url" {
  description = "Vercel-managed default production URL, or null when disabled."
  value       = var.enabled ? "https://${vercel_project.web[0].name}.vercel.app" : null
}
