terraform {
  required_version = ">= 1.7"

  required_providers {
    vercel = {
      source  = "vercel/vercel"
      version = "~> 3.0"
    }
    # Used by main.tf to write the Vercel deploy hook URL to a 0600-mode tmp file.
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    # Generates a stable suffix for the auto-claimed `*.vercel.app` subdomain.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}
