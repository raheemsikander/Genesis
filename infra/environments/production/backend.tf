terraform {
  cloud {
    # Bootstrap: create the organization + workspace manually in the Terraform
    # Cloud UI before the first `terraform init`. See infra/README.md.
    organization = "conrad-labs"
    workspaces {
      name = "genesis-production"
    }
  }
}
