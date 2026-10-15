variable "name" {
  type = string
}

variable "alb_arn" {
  type = string
}

variable "alb_dns_name" {
  type = string
}

variable "origin_header_name" {
  type = string
}

variable "domains" {
  type = object({
    zone_name = string
    web       = string
    api       = string
  })
  default     = null
  description = "Custom domains, e.g. { zone_name = \"example.com\", web = \"app.example.com\", api = \"api.example.com\" }. The zone must be a Route 53 hosted zone in this account. null serves on the default *.cloudfront.net names."
}

variable "price_class" {
  type        = string
  default     = "PriceClass_100"
  description = "PriceClass_100 = North America + Europe edges (cheapest). PriceClass_All for global edges."
}
