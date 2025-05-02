variable "app_name" {
  description = "Application name"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

resource "aws_sqs_queue" "bg_worker_dlq" {
  name = "${var.environment}-${var.app_name}-dlq"
  message_retention_seconds = 1209600  # 14 days
  
  tags = {
    Name        = "${var.environment}-${var.app_name}-dlq"
    Environment = var.environment
  }
}

resource "aws_sqs_queue" "bg_worker" {
  name = "${var.environment}-${var.app_name}-queue"
  visibility_timeout_seconds = 300  # 5 minutes
  message_retention_seconds = 86400  # 1 day
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.bg_worker_dlq.arn
    maxReceiveCount     = 5
  })
  
  tags = {
    Name        = "${var.environment}-${var.app_name}-queue"
    Environment = var.environment
  }
}

output "queue_url" {
  value = aws_sqs_queue.bg_worker.url
}

output "queue_arn" {
  value = aws_sqs_queue.bg_worker.arn
}

output "queue_name" {
  value = aws_sqs_queue.bg_worker.name
}