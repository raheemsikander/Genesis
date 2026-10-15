terraform {
  cloud {
    organization = "project-genesis"

    workspaces {
      name = "genesis-shared"
    }
  }
}
