// ECS Fargate cluster, IAM roles and log groups shared by every service.
//
// Resource graph:
//   aws_ecs_cluster
//   ├── api service    (root Dockerfile, behind the ALB)
//   ├── web service    (infra/aws/docker web target, behind the ALB)
//   ├── worker service (api image, BullMQ entrypoint; count = enable_worker)
//   └── migrate task definition (run once per deploy by the deploy workflow)
//
// Images are referenced by the environment tag (`:<env>`). The deploy workflow
// pushes that tag and forces a new deployment, so Terraform never fights CI
// over task-definition image digests.

locals {
  log_groups = concat(["api", "web", "migrate"], var.worker.enabled ? ["worker"] : [])
}

resource "aws_ecs_cluster" "main" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = var.container_insights ? "enabled" : "disabled"
  }
}

resource "aws_cloudwatch_log_group" "service" {
  for_each = toset(local.log_groups)

  name              = "/ecs/${var.name}/${each.value}"
  retention_in_days = var.log_retention_days
}

// =============================================================================
// IAM: the execution role pulls images, writes logs and resolves secrets;
// the task role is what the running container is allowed to do.
// =============================================================================

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "execution" {
  name               = "${var.name}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "execution_secrets" {
  name = "read-app-secrets"
  role = aws_iam_role.execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = var.secret_arns
    }]
  })
}

resource "aws_iam_role" "task" {
  name               = "${var.name}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

// Lets operators open a shell in a running task: `aws ecs execute-command`.
resource "aws_iam_role_policy" "task_exec_command" {
  name = "ecs-exec"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel",
      ]
      Resource = "*"
    }]
  })
}
