variable "app_name" {
  description = "Application name"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
}

variable "container_cpu" {
  description = "CPU units for the container (1024 = 1 vCPU)"
  type        = number
}

variable "container_memory" {
  description = "Memory for the container in MiB"
  type        = number
}

variable "ecr_repository_url" {
  description = "ECR repository URL"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for the ECS service"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID for the ECS service"
  type        = string
}

variable "sqs_queue_name" {
  description = "SQS queue name"
  type        = string
}

variable "task_role_arn" {
  description = "Task role ARN"
  type        = string
}

variable "execution_role_arn" {
  description = "Execution role ARN"
  type        = string
}

resource "aws_cloudwatch_log_group" "bg_worker" {
  name              = "/ecs/${var.environment}-${var.app_name}"
  retention_in_days = 30
  
  tags = {
    Name        = "${var.environment}-${var.app_name}-logs"
    Environment = var.environment
  }
}

resource "aws_ecs_cluster" "bg_worker" {
  name = "${var.environment}-${var.app_name}-cluster"
  
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
  
  tags = {
    Name        = "${var.environment}-${var.app_name}-cluster"
    Environment = var.environment
  }
}

resource "aws_ecs_task_definition" "bg_worker" {
  family                   = "${var.environment}-${var.app_name}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.container_cpu
  memory                   = var.container_memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([{
    name      = "${var.environment}-${var.app_name}"
    image     = "${var.ecr_repository_url}:latest"
    essential = true
    
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.bg_worker.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
    
    environment = [
      { name = "NODE_ENV", value = var.environment },
      { name = "SQS_QUEUE_NAME", value = var.sqs_queue_name },
      { name = "AWS_REGION", value = var.aws_region }
      # Add other environment variables as needed
    ]
  }])
  
  tags = {
    Name        = "${var.environment}-${var.app_name}-task"
    Environment = var.environment
  }
}

resource "aws_ecs_service" "bg_worker" {
  name            = "${var.environment}-${var.app_name}"
  cluster         = aws_ecs_cluster.bg_worker.id
  task_definition = aws_ecs_task_definition.bg_worker.arn
  desired_count   = 0  # Start with zero tasks, autoscaling will handle it
  launch_type     = "FARGATE"
  
  # Service-linked role is created manually
  
  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = true  # For simplicity; consider using private subnets with NAT gateway in production
  }
  
  deployment_minimum_healthy_percent = 0  # Allow scaling to zero
  deployment_maximum_percent         = 200
  
  tags = {
    Name        = "${var.environment}-${var.app_name}-service"
    Environment = var.environment
  }
}

# Check if the service-linked role exists
data "aws_iam_role" "ecs_autoscaling_service_role" {
  name = "AWSServiceRoleForApplicationAutoScaling_ECSService"
  # This will fail silently if the role doesn't exist, and Terraform will handle it gracefully
}

# Note: If the above data source fails, you'll need to create the service-linked role manually:
# aws iam create-service-linked-role --aws-service-name ecs.application-autoscaling.amazonaws.com

resource "aws_appautoscaling_target" "ecs_target" {
  max_capacity       = 10
  min_capacity       = 0
  resource_id        = "service/${aws_ecs_cluster.bg_worker.name}/${aws_ecs_service.bg_worker.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
  
  # The depends_on ensures Terraform tries to fetch the role first
  depends_on = [data.aws_iam_role.ecs_autoscaling_service_role]
}

resource "aws_appautoscaling_policy" "sqs_policy" {
  name               = "${var.environment}-${var.app_name}-autoscaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs_target.resource_id
  scalable_dimension = aws_appautoscaling_target.ecs_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs_target.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 2.0  # Aim for ~2 messages per task
    scale_in_cooldown  = 300  # 5 minutes
    scale_out_cooldown = 60   # 1 minute

    customized_metric_specification {
      metric_name = "ApproximateNumberOfMessagesVisible"
      namespace   = "AWS/SQS"
      statistic   = "Average"
      
      dimensions {
        name  = "QueueName"
        value = var.sqs_queue_name
      }
    }
  }
}

output "cluster_name" {
  value = aws_ecs_cluster.bg_worker.name
}

output "service_name" {
  value = aws_ecs_service.bg_worker.name
}
