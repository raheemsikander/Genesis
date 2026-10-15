// Public entry point: one CloudFront distribution each for the web app and
// the API, both fronting the internal ALB through a CloudFront VPC origin.
//
// Without custom domains the distributions serve HTTPS on their default
// *.cloudfront.net names. With `domains` set, an ACM certificate (us-east-1,
// as CloudFront requires) is DNS-validated in the Route 53 zone and alias
// records point the names at the distributions.

locals {
  use_custom_domains = var.domains != null

  distributions = {
    web = {
      aliases      = local.use_custom_domains ? [var.domains.web] : []
      cache_static = true
    }
    api = {
      aliases      = local.use_custom_domains ? [var.domains.api] : []
      cache_static = false
    }
  }
}

data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

// Forwards every header (Host included), cookie and query string: Clerk
// needs its cookies and the app builds redirects from the viewer's Host.
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

resource "aws_cloudfront_vpc_origin" "alb" {
  vpc_origin_endpoint_config {
    name                   = var.name
    arn                    = var.alb_arn
    http_port              = 80
    https_port             = 443
    origin_protocol_policy = "http-only"

    origin_ssl_protocols {
      items    = ["TLSv1.2"]
      quantity = 1
    }
  }
}

resource "aws_cloudfront_distribution" "main" {
  for_each = local.distributions

  enabled         = true
  comment         = "${var.name} ${each.key}"
  aliases         = each.value.aliases
  price_class     = var.price_class
  http_version    = "http2and3"
  is_ipv6_enabled = true

  origin {
    origin_id   = "alb"
    domain_name = var.alb_dns_name

    vpc_origin_config {
      vpc_origin_id            = aws_cloudfront_vpc_origin.alb.id
      origin_read_timeout      = 60
      origin_keepalive_timeout = 5
    }

    custom_header {
      name  = var.origin_header_name
      value = each.key
    }
  }

  default_cache_behavior {
    target_origin_id         = "alb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  // Next.js hashed build assets are immutable, so the edge can cache them.
  dynamic "ordered_cache_behavior" {
    for_each = each.value.cache_static ? ["/_next/static/*"] : []

    content {
      path_pattern           = ordered_cache_behavior.value
      target_origin_id       = "alb"
      viewer_protocol_policy = "redirect-to-https"
      allowed_methods        = ["GET", "HEAD"]
      cached_methods         = ["GET", "HEAD"]
      compress               = true
      cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = !local.use_custom_domains
    acm_certificate_arn            = local.use_custom_domains ? aws_acm_certificate_validation.main[0].certificate_arn : null
    ssl_support_method             = local.use_custom_domains ? "sni-only" : null
    minimum_protocol_version       = local.use_custom_domains ? "TLSv1.2_2021" : "TLSv1"
  }
}

// =============================================================================
// Optional custom domains (Route 53 hosted zone in this account)
// =============================================================================

data "aws_route53_zone" "main" {
  count = local.use_custom_domains ? 1 : 0

  name = var.domains.zone_name
}

resource "aws_acm_certificate" "main" {
  count    = local.use_custom_domains ? 1 : 0
  provider = aws.us_east_1

  domain_name               = var.domains.web
  subject_alternative_names = [var.domains.api]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = local.use_custom_domains ? {
    for option in aws_acm_certificate.main[0].domain_validation_options : option.domain_name => option
  } : {}

  zone_id         = data.aws_route53_zone.main[0].zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "main" {
  count    = local.use_custom_domains ? 1 : 0
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.main[0].arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_route53_record" "alias" {
  for_each = local.use_custom_domains ? {
    for pair in setproduct(keys(local.distributions), ["A", "AAAA"]) : "${pair[0]}-${pair[1]}" => {
      distribution = pair[0]
      type         = pair[1]
    }
  } : {}

  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = var.domains[each.value.distribution]
  type    = each.value.type

  alias {
    name                   = aws_cloudfront_distribution.main[each.value.distribution].domain_name
    zone_id                = aws_cloudfront_distribution.main[each.value.distribution].hosted_zone_id
    evaluate_target_health = false
  }
}
