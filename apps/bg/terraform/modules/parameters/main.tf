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
