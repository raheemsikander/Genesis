// One complete environment (staging, production, ...):
//
//   network ── VPC, subnets, optional NAT
//   database ─ RDS Postgres      ┐
//   cache ──── ElastiCache Redis ├─ private subnets, reachable from app tasks only
//   ecs ────── internal ALB, api/web/worker services, migrate task
//   edge ───── CloudFront (web + api) → VPC origin → ALB, optional custom domains
//   storage ── S3 uploads bucket + scoped IAM key
//   deploy-access ─ GitHub OIDC deploy role + SSM deploy config
//
// The ECR repositories and the GitHub OIDC provider are account-wide and come
// from envs/shared; they are looked up by name here.

locals {
  name = "${var.project_name}-${var.environment}"

  // Public mode: tasks get public IPs in public subnets (no NAT to pay for).
  // Private mode: tasks hide in private subnets behind NAT.
  private_tasks = var.network_mode == "private"

  origin_header_name = "X-Origin-Target"
}

data "aws_ecr_repository" "app" {
  for_each = toset(["api", "web", "migrate"])

  name = "${var.project_name}/${each.key}"
}

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

module "network" {
  source = "../network"

  name               = local.name
  cidr_block         = var.vpc_cidr
  enable_nat         = local.private_tasks
  nat_gateway_per_az = var.nat_gateway_per_az
}

// =============================================================================
// Security groups: internet → CloudFront → (VPC origin) → ALB → app tasks.
// =============================================================================

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Internal ALB, reached by CloudFront VPC origin ENIs"
  vpc_id      = module.network.vpc_id
}

// The ALB is internal, so only addresses inside the VPC (the CloudFront VPC
// origin ENIs among them) can reach it.
resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = module.network.vpc_cidr_block
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
}

resource "aws_vpc_security_group_egress_rule" "alb_to_app" {
  security_group_id            = aws_security_group.alb.id
  referenced_security_group_id = aws_security_group.app.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

resource "aws_security_group" "app" {
  name        = "${local.name}-app"
  description = "ECS tasks: inbound from the ALB only"
  vpc_id      = module.network.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "app_from_alb" {
  security_group_id            = aws_security_group.app.id
  referenced_security_group_id = aws_security_group.alb.id
  ip_protocol                  = "tcp"
  from_port                    = 3000
  to_port                      = 3000
}

// Outbound: ECR, Secrets Manager, CloudWatch, Clerk, Resend, Rollbar, RDS, Redis.
resource "aws_vpc_security_group_egress_rule" "app_all" {
  security_group_id = aws_security_group.app.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

module "database" {
  source = "../database"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.app.id]
  database_name              = replace(var.project_name, "-", "_")
  instance_class             = var.database.instance_class
  allocated_storage          = var.database.allocated_storage
  multi_az                   = var.database.multi_az
  backup_retention_days      = var.database.backup_retention_days
  deletion_protection        = var.deletion_protection
}

module "cache" {
  source = "../cache"

  name                       = local.name
  vpc_id                     = module.network.vpc_id
  subnet_ids                 = module.network.private_subnet_ids
  allowed_security_group_ids = [aws_security_group.app.id]
  node_type                  = var.cache.node_type
  node_count                 = var.cache.node_count
}

module "storage" {
  source = "../storage"

  name       = local.name
  region     = var.region
  versioning = var.storage_versioning
}

// =============================================================================
// Secrets. Only non-empty values are stored, and the containers get exactly
// those keys, so optional integrations left blank are simply absent.
// =============================================================================

locals {
  app_secret_values = {
    for k, v in {
      DATABASE_URL          = module.database.database_url
      REDIS_URL             = module.cache.redis_url
      CLERK_SECRET_KEY      = var.app_secrets.clerk_secret_key
      CLERK_PUBLISHABLE_KEY = var.app_config.clerk_publishable_key
      S3_ACCESS_KEY_ID      = module.storage.access_key_id
      S3_SECRET_ACCESS_KEY  = module.storage.secret_access_key
      RESEND_API_KEY        = var.app_secrets.resend_api_key
      ROLLBAR_SERVER_TOKEN  = var.app_secrets.rollbar_server_token
    } : k => v if v != ""
  }

  // Which keys exist must be known at plan time (it shapes the task
  // definitions), so it is computed from inputs, never from generated values.
  // Whether a secret is set isn't itself secret, hence nonsensitive().
  optional_secret_inputs = {
    RESEND_API_KEY       = var.app_secrets.resend_api_key
    ROLLBAR_SERVER_TOKEN = var.app_secrets.rollbar_server_token
  }
  app_secret_keys = concat(
    ["DATABASE_URL", "REDIS_URL", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"],
    [for k, v in local.optional_secret_inputs : k if nonsensitive(v != "")],
  )

  secret_ref = { for k in local.app_secret_keys : k => "${aws_secretsmanager_secret.app.arn}:${k}::" }
}

resource "aws_secretsmanager_secret" "app" {
  name                    = "${local.name}/app"
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(local.app_secret_values)
}

resource "aws_secretsmanager_secret" "build" {
  name                    = "${local.name}/build"
  description             = "Build-time secrets read by the deploy workflow"
  recovery_window_in_days = var.secret_recovery_window_days
}

resource "aws_secretsmanager_secret_version" "build" {
  secret_id     = aws_secretsmanager_secret.build.id
  secret_string = jsonencode({ ROLLBAR_CLIENT_SOURCEMAP_TOKEN = var.app_secrets.rollbar_client_sourcemap_token })
}

module "ecs" {
  source = "../ecs"

  name   = local.name
  region = var.region

  vpc_id                = module.network.vpc_id
  alb_subnet_ids        = module.network.private_subnet_ids
  task_subnet_ids       = local.private_tasks ? module.network.private_subnet_ids : module.network.public_subnet_ids
  assign_public_ip      = !local.private_tasks
  app_security_group_id = aws_security_group.app.id
  alb_security_group_id = aws_security_group.alb.id
  origin_header_name    = local.origin_header_name

  api_image     = "${data.aws_ecr_repository.app["api"].repository_url}:${var.environment}"
  web_image     = "${data.aws_ecr_repository.app["web"].repository_url}:${var.environment}"
  migrate_image = "${data.aws_ecr_repository.app["migrate"].repository_url}:${var.environment}"

  api    = var.api
  web    = var.web
  worker = var.worker

  api_environment = merge(
    {
      NODE_ENV    = "production"
      CORS_ORIGIN = module.edge.web_url
      S3_ENDPOINT = module.storage.endpoint
      S3_REGION   = var.region
      S3_BUCKET   = module.storage.bucket_name
    },
    var.app_config.resend_from_email != "" ? { RESEND_FROM_EMAIL = var.app_config.resend_from_email } : {},
  )
  api_secrets = local.secret_ref

  // NEXT_PUBLIC_* are already inlined at build time; repeating them at
  // runtime covers server code that reads process.env directly.
  web_environment = {
    NODE_ENV                          = "production"
    HOSTNAME                          = "0.0.0.0"
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = var.app_config.clerk_publishable_key
    NEXT_PUBLIC_CLERK_SIGN_IN_URL     = "/sign-in"
    NEXT_PUBLIC_CLERK_SIGN_UP_URL     = "/sign-up"
    NEXT_PUBLIC_SERVER_URL            = module.edge.api_url
    NEXT_PUBLIC_NODE_ENV              = var.environment
  }
  web_secrets     = { CLERK_SECRET_KEY = local.secret_ref["CLERK_SECRET_KEY"] }

  secret_arns        = [aws_secretsmanager_secret.app.arn]
  log_retention_days = var.log_retention_days
}

module "edge" {
  source = "../edge"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  name               = local.name
  alb_arn            = module.ecs.alb_arn
  alb_dns_name       = module.ecs.alb_dns_name
  origin_header_name = local.origin_header_name
  domains            = var.domains
  price_class        = var.price_class
}

module "deploy_access" {
  source = "../deploy-access"

  project_name      = var.project_name
  environment       = var.environment
  region            = var.region
  github_repository = var.github_repository
  oidc_provider_arn = data.aws_iam_openid_connect_provider.github.arn

  ecr_repository_arns = [for repo in data.aws_ecr_repository.app : repo.arn]
  cluster_name        = module.ecs.cluster_name
  cluster_arn         = module.ecs.cluster_arn
  migrate_task_family = module.ecs.migrate_task_family
  migrate_log_group   = module.ecs.migrate_log_group
  task_role_arns      = module.ecs.role_arns
  build_secret_arn    = aws_secretsmanager_secret.build.arn

  deploy_config = {
    environment = var.environment
    cluster     = module.ecs.cluster_name
    services    = module.ecs.service_names
    migration = {
      task_definition  = module.ecs.migrate_task_family
      log_group        = module.ecs.migrate_log_group
      subnets          = local.private_tasks ? module.network.private_subnet_ids : module.network.public_subnet_ids
      security_groups  = [aws_security_group.app.id]
      assign_public_ip = local.private_tasks ? "DISABLED" : "ENABLED"
    }
    ecr = {
      api     = data.aws_ecr_repository.app["api"].repository_url
      web     = data.aws_ecr_repository.app["web"].repository_url
      migrate = data.aws_ecr_repository.app["migrate"].repository_url
    }
    build_secret_arn = aws_secretsmanager_secret.build.arn
    // NEXT_PUBLIC_* values end up in the browser bundle anyway; none are secret.
    web_build_args = {
      NEXT_PUBLIC_SERVER_URL            = module.edge.api_url
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = var.app_config.clerk_publishable_key
      NEXT_PUBLIC_NODE_ENV              = var.environment
      NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN  = var.app_config.next_public_rollbar_client_token
      NEXT_PUBLIC_MIXPANEL_TOKEN        = var.app_config.next_public_mixpanel_token
      NEXT_PUBLIC_GA4_MEASUREMENT_ID    = var.app_config.next_public_ga4_measurement_id
      DEPLOY_URL                        = module.edge.web_url
    }
  }
}
