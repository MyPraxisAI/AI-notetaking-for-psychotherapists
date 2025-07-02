variable "app_name" {
  description = "Application name"
  type        = string
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

variable "parameters" {
  description = "Map of parameter names to parameter values"
  type        = map(string)
  sensitive   = true
}

# Create secure string parameters in Parameter Store
resource "aws_ssm_parameter" "secure_parameters" {
  for_each = var.parameters

  name        = "/${var.environment}/${var.app_name}/${each.key}"
  description = "${each.key} parameter for ${var.app_name} in ${var.environment}"
  type        = "SecureString"
  value       = each.value
  tier        = "Standard"  # Free tier
  
  tags = {
    Environment = var.environment
    Application = var.app_name
  }
}

output "parameter_arns" {
  description = "ARNs of the created parameters"
  value       = { for k, v in aws_ssm_parameter.secure_parameters : k => v.arn }
}

output "secrets" {
  description = "Secrets"
  value = [
    { 
      name = "OPENAI_API_KEY", 
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/OPENAI_API_KEY" 
    },
    { 
      name = "GOOGLE_API_KEY", 
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/GOOGLE_API_KEY" 
    },
    {
      name = "SUPABASE_URL",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/SUPABASE_URL"
    },
    {
      name = "SUPABASE_KEY",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/SUPABASE_KEY"
    },
    {
      name = "SUPABASE_SERVICE_ROLE_KEY",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/SUPABASE_SERVICE_ROLE_KEY"
    },
    {
      name = "YANDEX_FOLDER_ID",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/YANDEX_FOLDER_ID"
    },
    {
      name = "YANDEX_STORAGE_BUCKET",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/YANDEX_STORAGE_BUCKET"
    },
    {
      name = "YANDEX_API_KEY",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/YANDEX_API_KEY"
    },
    {
      name = "YANDEX_ACCESS_KEY_ID",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/YANDEX_ACCESS_KEY_ID"
    },
    {
      name = "YANDEX_SECRET_ACCESS_KEY",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/YANDEX_SECRET_ACCESS_KEY"
    },
    {
      name = "SENTRY_DSN",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/SENTRY_DSN"
    },
    {
      name = "ASSEMBLYAI_API_KEY",
      valueFrom = "arn:aws:ssm:${var.aws_region}:${var.aws_account_id}:parameter/${var.environment}/${var.app_name}/ASSEMBLYAI_API_KEY"
    }
  ]
}
