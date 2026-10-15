output "web_url" {
  value = module.environment.web_url
}

output "api_url" {
  value = module.environment.api_url
}

output "deploy_role_arn" {
  value = module.environment.deploy_role_arn
}

output "cluster_name" {
  value = module.environment.cluster_name
}

output "github_setup" {
  description = "Run once (needs the gh CLI) so the deploy workflow can reach this environment."
  value       = <<-EOT
    gh variable set AWS_DEPLOY_ROLE_ARN --env ${var.environment} --body "${module.environment.deploy_role_arn}"
    gh variable set AWS_DEPLOY_CONFIG_PARAMETER --env ${var.environment} --body "${module.environment.deploy_config_parameter}"
    gh variable set AWS_REGION --body "${var.region}"
    gh variable set DEPLOY_TARGET --body "aws"
  EOT
}
