terraform {
  required_version = ">= 1.6.0"
  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.7"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.15"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}
