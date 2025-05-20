output "lifecycle_policy_id" {
  description = "ID of the ECR lifecycle policy"
  value       = aws_ecr_lifecycle_policy.repository_policy.id
}
