output "bucket_name" {
  description = "R2 bucket name, or null when disabled."
  value       = var.enabled ? cloudflare_r2_bucket.main[0].name : null
}

output "s3_endpoint" {
  description = "S3-compatible endpoint for the R2 bucket, or null when disabled."
  value       = var.enabled ? "https://${var.account_id}.r2.cloudflarestorage.com" : null
}
