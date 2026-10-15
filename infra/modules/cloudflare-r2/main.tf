resource "cloudflare_r2_bucket" "main" {
  count = var.enabled ? 1 : 0

  account_id = var.account_id
  name       = "${var.app_name}-${var.environment}-uploads"
  location   = var.location

  # Hard guard against accidental data loss. To intentionally destroy the
  # bucket (e.g. when decommissioning the environment), temporarily remove
  # this block, apply, then restore it.
  lifecycle {
    prevent_destroy = true
  }
}
