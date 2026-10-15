// CANONICAL per-environment root. envs/production/{main,variables,outputs,versions}.tf
// are symlinks to the files in this directory: environments differ only in
// backend.tf (state key), terraform.tfvars (sizing) and .envrc (secrets).
// To add an environment, copy envs/production and change those three files.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "aws"
    }
  }
}

// CloudFront only accepts ACM certificates from us-east-1.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Stack       = "aws"
    }
  }
}

module "environment" {
  source = "../../modules/environment"

  providers = {
    aws           = aws
    aws.us_east_1 = aws.us_east_1
  }

  project_name      = var.project_name
  environment       = var.environment
  region            = var.region
  github_repository = var.github_repository

  network_mode       = var.network_mode
  nat_gateway_per_az = var.nat_gateway_per_az

  database            = var.database
  cache               = var.cache
  storage_versioning  = var.storage_versioning
  deletion_protection = var.deletion_protection

  api    = var.api
  web    = var.web
  worker = var.worker

  domains     = var.domains
  price_class = var.price_class

  app_config = {
    clerk_publishable_key            = var.clerk_publishable_key
    resend_from_email                = var.resend_from_email
    next_public_rollbar_client_token = var.next_public_rollbar_client_token
    next_public_mixpanel_token       = var.next_public_mixpanel_token
    next_public_ga4_measurement_id   = var.next_public_ga4_measurement_id
  }

  app_secrets = {
    clerk_secret_key               = var.clerk_secret_key
    resend_api_key                 = var.resend_api_key
    rollbar_server_token           = var.rollbar_server_token
    rollbar_client_sourcemap_token = var.rollbar_client_sourcemap_token
  }

  log_retention_days          = var.log_retention_days
  secret_recovery_window_days = var.secret_recovery_window_days
}
