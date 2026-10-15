output "environment_name" {
  description = "Name of the managed GitHub Actions environment."
  value       = github_repository_environment.env.environment
}
