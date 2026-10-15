terraform {
  cloud {
    organization = "conradlabs"

    workspaces {
      name = "genesis-shared"
    }
  }
}
