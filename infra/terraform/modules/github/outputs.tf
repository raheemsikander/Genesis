output "environment_name" {
  value       = github_repository_environment.main.environment
  description = "Name of the GitHub Environment created by this module. Same value as var.environment, surfaced for convenience in env-root outputs."
}
