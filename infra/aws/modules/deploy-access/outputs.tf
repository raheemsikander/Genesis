output "role_arn" {
  value = aws_iam_role.deploy.arn
}

output "deploy_config_parameter" {
  value = aws_ssm_parameter.deploy_config.name
}
