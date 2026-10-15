output "cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "cluster_arn" {
  value = aws_ecs_cluster.main.arn
}

output "service_names" {
  value = {
    api    = aws_ecs_service.api.name
    web    = aws_ecs_service.web.name
    worker = length(aws_ecs_service.worker) > 0 ? aws_ecs_service.worker[0].name : null
  }
}

output "migrate_task_family" {
  value = aws_ecs_task_definition.migrate.family
}

output "migrate_log_group" {
  value = aws_cloudwatch_log_group.service["migrate"].name
}

output "alb_arn" {
  value = aws_lb.main.arn
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "role_arns" {
  value = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
}
