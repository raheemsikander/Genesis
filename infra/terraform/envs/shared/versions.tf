terraform {
  required_version = ">= 1.7"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.7"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.0"
    }
  }
}
