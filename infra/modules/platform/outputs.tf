output "server_url" {
  description = "Public backend URL on Render."
  value       = module.render.server_url
}

output "web_url" {
  description = "Public frontend URL on Vercel."
  value       = module.vercel.default_url
}

output "github_environment" {
  description = "GitHub Actions environment name wired for this stack."
  value       = module.github.environment_name
}

output "r2_bucket" {
  description = "R2 bucket name, or null when disabled."
  value       = module.r2.bucket_name
}
