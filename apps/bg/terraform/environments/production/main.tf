# Get current AWS account ID
data "aws_caller_identity" "current" {}

module "vpc" {
  source = "../../modules/vpc"

  app_name    = var.app_name
  environment = var.environment
  aws_region  = var.aws_region
}

module "sqs_queues" {
  source = "../../modules/sqs-queues"

  app_name    = var.app_name
  environment = var.environment
}

module "iam" {
  source = "../../modules/iam"

  app_name      = var.app_name
  environment   = var.environment
  aws_region    = var.aws_region
  sqs_queue_arn = module.sqs_queues.queue_arn
}

# Parameter Store for secrets
# Note: This module is commented out to avoid storing sensitive values in Terraform state
# You should create these parameters manually using AWS CLI or console
/*
module "parameters" {
  source = "../../modules/parameters"

  app_name    = var.app_name
  environment = var.environment
  aws_region  = var.aws_region
  
  parameters = {
    # DO NOT store actual secrets here - this is just an example
    # OPENAI_API_KEY = "your-api-key"
    # Add other secrets as needed
  }
}
*/

module "ecs_service" {
  source = "../../modules/ecs-service"

  app_name           = var.app_name
  environment        = var.environment
  aws_region         = var.aws_region
  container_cpu      = var.container_cpu
  container_memory   = var.container_memory
  ecr_repository_url = data.aws_ecr_repository.bg_worker.repository_url
  subnet_ids         = module.vpc.subnet_ids
  security_group_id  = module.vpc.security_group_id
  sqs_queue_name     = module.sqs_queues.queue_name
  task_role_arn      = module.iam.task_role_arn
  execution_role_arn = module.iam.execution_role_arn
  aws_account_id     = data.aws_caller_identity.current.account_id
  min_capacity       = var.min_capacity
}

# Use data source to reference existing ECR repository
data "aws_ecr_repository" "bg_worker" {
  name = var.ecr_repository_name
}

# Output values
output "ecr_repository_url" {
  value = data.aws_ecr_repository.bg_worker.repository_url
}

output "ecs_cluster_name" {
  value = module.ecs_service.cluster_name
}

output "ecs_service_name" {
  value = module.ecs_service.service_name
}