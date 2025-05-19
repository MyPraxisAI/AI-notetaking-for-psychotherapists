variable "aws_region" {
  description = "AWS region to deploy resources"
  default     = "eu-west-1"
}

variable "app_name" {
  description = "Application name"
  default     = "mypraxis-bg-worker"
}

variable "ecr_repository_name" {
  description = "ECR repository name"
  default     = "mypraxis/bg-worker"
}

variable "environment" {
  description = "Deployment environment"
  default     = "production"
}

variable "container_cpu" {
  description = "CPU units for the container (1024 = 1 vCPU)"
  default     = 512
}

variable "container_memory" {
  description = "Memory for the container in MiB"
  default     = 1024
}

variable "min_capacity" {
  description = "Minimum number of tasks to run"
  default     = 1
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"  # Default, but should be overridden during deployment
}