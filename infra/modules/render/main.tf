locals {
  name_prefix = "${var.app_name}-${var.environment}"
}

# One Render project per Terraform environment. The project holds exactly one
# Render-level environment; all services are scoped to it.
resource "render_project" "main" {
  name = "${var.app_name}-${var.environment}"

  environments = {
    (var.environment) = {
      name             = var.environment
      protected_status = var.environment == "production" ? "protected" : "unprotected"
    }
  }
}

locals {
  environment_id = render_project.main.environments[var.environment].id
}

# prevent_destroy blocks any plan that would destroy Postgres. See
# infra/README.md "Removing an environment" for the intentional-teardown flow.
resource "render_postgres" "main" {
  name           = "${local.name_prefix}-db"
  environment_id = local.environment_id
  region         = var.region
  plan           = var.postgres_plan
  version        = "16"
  ip_allow_list  = []

  lifecycle {
    prevent_destroy = true
  }
}

# Key Value (Redis-compatible). Always provisioned - BullMQ needs it even when
# the worker service is disabled (the backend may still enqueue jobs).
resource "render_keyvalue" "main" {
  name              = "${local.name_prefix}-kv"
  environment_id    = local.environment_id
  region            = var.region
  plan              = var.key_value_plan
  max_memory_policy = "allkeys_lru"
  ip_allow_list     = []
}

# Shared env group carries secrets + non-secrets applied to web and worker.
resource "render_env_group" "shared" {
  name           = "${local.name_prefix}-env"
  environment_id = local.environment_id

  env_vars = merge(
    { for k, v in var.env_vars : k => { value = v } },
    # Iterate over non-sensitive keys, look up values by key to avoid sensitive
    # for_each errors. value = { ... } marks the map value as sensitive through
    # the assignment below.
    { for k in nonsensitive(keys(var.secret_env_vars)) : k => { value = var.secret_env_vars[k] } },
  )
}

resource "render_web_service" "backend" {
  count = var.service_enabled ? 1 : 0

  depends_on = [
    render_postgres.main,
    render_keyvalue.main,
    render_env_group.shared,
  ]

  name           = "${local.name_prefix}-server"
  environment_id = local.environment_id
  plan           = var.server_plan
  region         = var.region

  start_command      = var.server_start_command
  pre_deploy_command = var.server_pre_deploy_command

  runtime_source = {
    native_runtime = {
      auto_deploy   = true
      branch        = var.branch
      build_command = var.server_build_command
      repo_url      = var.repo_url
      runtime       = "node"
    }
  }

  env_vars = {
    DATABASE_URL = { value = render_postgres.main.connection_info.internal_connection_string }
    REDIS_URL    = { value = render_keyvalue.main.connection_info.internal_connection_string }
    PORT         = { value = var.server_port }
  }
}

resource "render_background_worker" "worker" {
  count = var.service_enabled && var.enable_worker ? 1 : 0

  depends_on = [
    render_postgres.main,
    render_keyvalue.main,
    render_env_group.shared,
  ]

  name           = "${local.name_prefix}-worker"
  environment_id = local.environment_id
  plan           = var.worker_plan
  region         = var.region

  start_command = var.worker_start_command

  # Run the same migration on worker deploy. Drizzle migrations are idempotent
  # so this is a no-op after the web service migrates, but it closes the race
  # where the worker could otherwise boot against an unmigrated schema.
  pre_deploy_command = var.server_pre_deploy_command

  runtime_source = {
    native_runtime = {
      auto_deploy   = true
      branch        = var.branch
      build_command = var.server_build_command
      repo_url      = var.repo_url
      runtime       = "node"
    }
  }

  env_vars = {
    DATABASE_URL = { value = render_postgres.main.connection_info.internal_connection_string }
    REDIS_URL    = { value = render_keyvalue.main.connection_info.internal_connection_string }
  }
}

# Attach the shared env group to the backend + worker. Replaces the v1.x
# env_group_ids field that is no longer on the service resources.
resource "render_env_group_link" "shared" {
  env_group_id = render_env_group.shared.id
  service_ids = toset(concat(
    [for s in render_web_service.backend : s.id],
    [for w in render_background_worker.worker : w.id],
  ))
}
