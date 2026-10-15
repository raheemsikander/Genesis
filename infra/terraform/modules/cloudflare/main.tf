// Cloudflare R2 module — per-environment bucket.
//
// R2 S3-compatible credentials (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) are
// not managed here — create them in the Cloudflare dashboard under
// R2 → Manage R2 API tokens and supply them via TF_VAR_s3_access_key_id /
// TF_VAR_s3_secret_access_key. Automating credential creation would write the
// secret into Terraform state.

resource "cloudflare_r2_bucket" "main" {
  count = var.enable_r2 ? 1 : 0

  account_id = var.cloudflare_account_id
  name       = "${var.project_name}-${var.environment}"

  lifecycle {
    prevent_destroy = true
  }
}
