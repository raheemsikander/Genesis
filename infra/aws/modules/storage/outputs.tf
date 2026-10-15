output "bucket_name" {
  value = aws_s3_bucket.uploads.bucket
}

output "endpoint" {
  value = "https://s3.${var.region}.amazonaws.com"
}

output "access_key_id" {
  value     = aws_iam_access_key.app.id
  sensitive = true
}

output "secret_access_key" {
  value     = aws_iam_access_key.app.secret
  sensitive = true
}
