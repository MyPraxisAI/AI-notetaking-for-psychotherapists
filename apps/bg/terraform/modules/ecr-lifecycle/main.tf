resource "aws_ecr_lifecycle_policy" "repository_policy" {
  repository = var.repository_name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1,
        description  = "Keep only the last 5 images",
        selection = {
          tagStatus     = "any",
          countType     = "imageCountMoreThan",
          countNumber   = 5
        },
        action = {
          type = "expire"
        }
      }
    ]
  })
}
