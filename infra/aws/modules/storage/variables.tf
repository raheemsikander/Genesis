variable "name" {
  type = string
}

variable "region" {
  type        = string
  description = "Bucket region; used to build the S3_ENDPOINT the server signs against."
}

variable "versioning" {
  type        = bool
  default     = false
  description = "Keep previous object versions (protects against accidental overwrite/delete, costs extra storage)."
}
