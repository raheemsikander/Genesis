output "bucket_name" {
  value       = var.enable_r2 ? cloudflare_r2_bucket.main[0].name : ""
  description = "R2 bucket name — maps to S3_BUCKET in the server env group."
}

output "endpoint" {
  value       = var.enable_r2 ? "https://${var.cloudflare_account_id}.r2.cloudflarestorage.com" : ""
  description = "R2 S3-compatible endpoint URL — maps to S3_ENDPOINT in the server env group."
}

output "region" {
  value       = var.enable_r2 ? "auto" : ""
  description = "R2 region string. Always 'auto' for Cloudflare R2."
}
