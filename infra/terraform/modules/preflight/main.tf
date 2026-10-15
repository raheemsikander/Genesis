// Preflight checks — see variables.tf for the rationale.
//
// Each precondition is evaluated during plan. If any fail, the plan errors out
// listing every failure (not just the first), and no resources are created or
// destroyed. To add a check, drop another `precondition` block below.

resource "terraform_data" "checks" {
  lifecycle {
    precondition {
      condition     = length(var.clerk_secret_key) > 0
      error_message = "TF_VAR_clerk_secret_key is empty. Set it in infra/terraform/envs/${var.environment}/.envrc — sk_test_… for staging, sk_live_… for production."
    }

    precondition {
      condition     = length(var.clerk_publishable_key) > 0
      error_message = "TF_VAR_clerk_publishable_key is empty. Set it in infra/terraform/envs/${var.environment}/.envrc — pk_test_… for staging, pk_live_… for production."
    }

    precondition {
      condition     = !var.enable_r2 || length(var.cloudflare_account_id) > 0
      error_message = "enable_r2 = true but TF_VAR_cloudflare_account_id is empty. Set it in infra/terraform/envs/shared/.envrc, or flip enable_r2 = false in terraform.tfvars. See docs/setup/integrations/R2_STORAGE.md."
    }

    precondition {
      condition     = !var.enable_r2 || length(var.s3_access_key_id) > 0
      error_message = "enable_r2 = true but TF_VAR_s3_access_key_id is empty. Create an R2 API token in the Cloudflare dashboard (docs/setup/integrations/R2_STORAGE.md) and set it in infra/terraform/envs/${var.environment}/.envrc."
    }

    precondition {
      condition     = !var.enable_r2 || length(var.s3_secret_access_key) > 0
      error_message = "enable_r2 = true but TF_VAR_s3_secret_access_key is empty. Create an R2 API token in the Cloudflare dashboard (docs/setup/integrations/R2_STORAGE.md) and set it in infra/terraform/envs/${var.environment}/.envrc."
    }
  }
}
