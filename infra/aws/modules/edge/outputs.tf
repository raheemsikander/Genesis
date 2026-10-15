output "web_url" {
  value = "https://${local.use_custom_domains ? var.domains.web : aws_cloudfront_distribution.main["web"].domain_name}"
}

output "api_url" {
  value = "https://${local.use_custom_domains ? var.domains.api : aws_cloudfront_distribution.main["api"].domain_name}"
}

output "distribution_ids" {
  value = { for k, d in aws_cloudfront_distribution.main : k => d.id }
}
