// Account-wide resources every AWS environment uses. Apply once, before any
// environment root. Environments find these by name, not via remote state.
//
//   ECR repositories   <project>/api, <project>/web, <project>/migrate
//   GitHub OIDC provider (unless the account already has one)

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = var.project_name
      ManagedBy = "terraform"
      Stack     = "aws"
    }
  }
}

resource "aws_ecr_repository" "app" {
  for_each = toset(["api", "web", "migrate"])

  name = "${var.project_name}/${each.key}"

  // Mutable so the deploy workflow can move the per-environment tag
  // (`:staging`, `:production`) the ECS task definitions point at. Every
  // image is also pushed under its immutable commit-SHA tag.
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  for_each = aws_ecr_repository.app

  repository = each.value.name

  policy = jsonencode({
    rules = [
      // An image matched by a rule can't be expired by a lower-priority rule,
      // so this keeps whatever each environment is currently running, however
      // old, safe from the count-based rule below.
      {
        rulePriority = 1
        description  = "Never expire images an environment is running"
        selection = {
          tagStatus      = "tagged"
          tagPatternList = var.environment_tags
          countType      = "imageCountMoreThan"
          countNumber    = 9999
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Drop untagged layers after a week"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 7
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 3
        description  = "Keep the newest images for rollbacks"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.images_to_keep
        }
        action = { type = "expire" }
      },
    ]
  })
}

// An AWS account can hold only one provider per issuer URL. Set
// create_github_oidc_provider = false when another stack already made it.
resource "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 1 : 0

  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}
