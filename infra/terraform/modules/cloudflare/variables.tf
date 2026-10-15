variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID. Visible in any Cloudflare dashboard URL or in Account Settings → General → Account ID."
}

variable "project_name" {
  type        = string
  description = "Project name — used as a bucket name prefix (e.g. 'project' → bucket 'project-staging')."
}

variable "environment" {
  type        = string
  description = "Deployment environment (staging or production)."
}

variable "enable_r2" {
  type        = bool
  default     = true
  description = "Create the Cloudflare R2 bucket. Set to false to skip R2 provisioning (S3_* env vars will be empty on the Render service)."
}
