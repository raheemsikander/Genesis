output "web_url" {
  value = module.edge.web_url
}

output "api_url" {
  value = module.edge.api_url
}

output "deploy_role_arn" {
  value = module.deploy_access.role_arn
}

output "deploy_config_parameter" {
  value = module.deploy_access.deploy_config_parameter
}

output "cluster_name" {
  value = module.ecs.cluster_name
}
