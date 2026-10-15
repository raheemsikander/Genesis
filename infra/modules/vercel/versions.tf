terraform {
  required_version = ">= 1.6.0"
  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.15"
    }
  }
}
