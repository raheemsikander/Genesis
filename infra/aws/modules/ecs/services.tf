locals {
  network_configuration = {
    subnets          = var.task_subnet_ids
    security_groups  = [var.app_security_group_id]
    assign_public_ip = var.assign_public_ip
  }

  // ECS takes env vars and secrets as name/value lists; callers pass maps.
  api_environment = [for k, v in var.api_environment : { name = k, value = v }]
  api_secrets     = [for k, v in var.api_secrets : { name = k, valueFrom = v }]
  web_environment = [for k, v in var.web_environment : { name = k, value = v }]
  web_secrets     = [for k, v in var.web_secrets : { name = k, valueFrom = v }]

  log_options = {
    for group in local.log_groups : group => {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.service[group].name
        "awslogs-region"        = var.region
        "awslogs-stream-prefix" = group
      }
    }
  }
}

// =============================================================================
// Task definitions
// =============================================================================

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.api.cpu
  memory                   = var.api.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name             = "api"
    image            = var.api_image
    essential        = true
    portMappings     = [{ containerPort = var.container_port, protocol = "tcp" }]
    environment      = local.api_environment
    secrets          = local.api_secrets
    logConfiguration = local.log_options["api"]
    linuxParameters  = { initProcessEnabled = true }
  }])
}

resource "aws_ecs_task_definition" "web" {
  family                   = "${var.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.web.cpu
  memory                   = var.web.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name             = "web"
    image            = var.web_image
    essential        = true
    portMappings     = [{ containerPort = var.container_port, protocol = "tcp" }]
    environment      = local.web_environment
    secrets          = local.web_secrets
    logConfiguration = local.log_options["web"]
    linuxParameters  = { initProcessEnabled = true }
  }])
}

resource "aws_ecs_task_definition" "worker" {
  count = var.worker.enabled ? 1 : 0

  family                   = "${var.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.worker.cpu
  memory                   = var.worker.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name             = "worker"
    image            = var.api_image
    essential        = true
    command          = ["node", "apps/server/dist/async-tasks/worker.mjs"]
    environment      = local.api_environment
    secrets          = local.api_secrets
    logConfiguration = local.log_options["worker"]
    linuxParameters  = { initProcessEnabled = true }
  }])
}

resource "aws_ecs_task_definition" "migrate" {
  family                   = "${var.name}-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name             = "migrate"
    image            = var.migrate_image
    essential        = true
    environment      = [{ name = "NODE_ENV", value = "production" }]
    secrets          = [{ name = "DATABASE_URL", valueFrom = var.api_secrets["DATABASE_URL"] }]
    logConfiguration = local.log_options["migrate"]
  }])
}

// =============================================================================
// Services
// =============================================================================

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api.desired_count
  launch_type     = "FARGATE"

  enable_execute_command            = true
  health_check_grace_period_seconds = 60
  propagate_tags                    = "SERVICE"

  network_configuration {
    subnets          = local.network_configuration.subnets
    security_groups  = local.network_configuration.security_groups
    assign_public_ip = local.network_configuration.assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  // Autoscaling owns the running count once the service exists.
  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener_rule.by_origin]
}

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web.desired_count
  launch_type     = "FARGATE"

  enable_execute_command            = true
  health_check_grace_period_seconds = 60
  propagate_tags                    = "SERVICE"

  network_configuration {
    subnets          = local.network_configuration.subnets
    security_groups  = local.network_configuration.security_groups
    assign_public_ip = local.network_configuration.assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = var.container_port
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  depends_on = [aws_lb_listener_rule.by_origin]
}

resource "aws_ecs_service" "worker" {
  count = var.worker.enabled ? 1 : 0

  name            = "worker"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker[0].arn
  desired_count   = var.worker.desired_count
  launch_type     = "FARGATE"

  enable_execute_command = true
  propagate_tags         = "SERVICE"

  network_configuration {
    subnets          = local.network_configuration.subnets
    security_groups  = local.network_configuration.security_groups
    assign_public_ip = local.network_configuration.assign_public_ip
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

// =============================================================================
// CPU target-tracking autoscaling for the request-serving services. With
// max_count == desired_count the service simply stays at that size.
// =============================================================================

resource "aws_appautoscaling_target" "service" {
  for_each = {
    api = { service = aws_ecs_service.api.name, min = var.api.desired_count, max = var.api.max_count }
    web = { service = aws_ecs_service.web.name, min = var.web.desired_count, max = var.web.max_count }
  }

  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.main.name}/${each.value.service}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = each.value.min
  max_capacity       = each.value.max
}

resource "aws_appautoscaling_policy" "cpu" {
  for_each = aws_appautoscaling_target.service

  name               = "${var.name}-${each.key}-cpu"
  policy_type        = "TargetTrackingScaling"
  service_namespace  = each.value.service_namespace
  resource_id        = each.value.resource_id
  scalable_dimension = each.value.scalable_dimension

  target_tracking_scaling_policy_configuration {
    target_value       = 60
    scale_in_cooldown  = 300
    scale_out_cooldown = 60

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}
