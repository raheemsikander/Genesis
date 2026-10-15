terraform {
  required_version = ">= 1.7"

  required_providers {
    render = {
      source  = "render-oss/render"
      version = "~> 1.7"
    }
    # Used by migrations.tf to write the Postgres URL to a 0600-mode tmp file.
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}
