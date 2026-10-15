// Vercel project environment variables — scoped to the env we're provisioning.
//
// Each entry uses one of:
//   - target = ["production"]                          for var.environment == "production"
//   - custom_environment_ids = [<staging custom env>]  for non-prod envs
//
// The wiring is computed once in main.tf's locals (env_target / env_custom_environment).

locals {
  // Single source of truth: declare every env var once, then a for_each
  // creates the resources. Cleaner than 9 explicit resources.
  app_env_vars = {
    NEXT_PUBLIC_SERVER_URL = {
      value     = var.next_public_server_url
      sensitive = false
    }
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = {
      value     = var.clerk_publishable_key
      sensitive = true
    }
    CLERK_SECRET_KEY = {
      value     = var.clerk_secret_key
      sensitive = true
    }
    NEXT_PUBLIC_CLERK_SIGN_IN_URL = {
      value     = "/sign-in"
      sensitive = false
    }
    NEXT_PUBLIC_CLERK_SIGN_UP_URL = {
      value     = "/sign-up"
      sensitive = false
    }
    NEXT_PUBLIC_NODE_ENV = {
      value     = var.environment
      sensitive = false
    }
    NEXT_PUBLIC_ROLLBAR_CLIENT_TOKEN = {
      value     = var.next_public_rollbar_client_token
      sensitive = true
    }
    ROLLBAR_CLIENT_SOURCEMAP_TOKEN = {
      value     = var.rollbar_client_sourcemap_token
      sensitive = true
    }
    NEXT_PUBLIC_MIXPANEL_TOKEN = {
      value     = var.next_public_mixpanel_token
      sensitive = true
    }
    DEPLOY_URL = {
      // Derived from local.effective_domain so it always matches the frontend's
      // public URL — keeps Rollbar source-map prefix in sync without a second var.
      value     = "https://${local.effective_domain}"
      sensitive = false
    }
  }
}

resource "vercel_project_environment_variable" "main" {
  for_each = local.app_env_vars

  project_id = var.project_id
  team_id    = local.team_id

  key       = each.key
  value     = each.value.value
  sensitive = each.value.sensitive

  target                 = local.env_target
  custom_environment_ids = local.env_custom_environment
}
