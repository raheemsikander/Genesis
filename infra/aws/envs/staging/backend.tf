// Bucket and region come from ../../backend.hcl (written by infra/aws/bootstrap):
//   terraform init -backend-config=../../backend.hcl
terraform {
  backend "s3" {
    key = "staging/terraform.tfstate"
  }
}
