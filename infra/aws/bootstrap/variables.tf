variable "project_name" {
  type = string
}

variable "region" {
  type        = string
  description = "Region of the state bucket. Keep it the same as the environments' region."
}
