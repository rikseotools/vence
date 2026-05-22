output "ecr_repository_url" {
  description = "URL del repositorio ECR — destino del docker push."
  value       = aws_ecr_repository.backend.repository_url
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS."
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS."
  value       = aws_ecs_service.backend.name
}

output "cloudwatch_log_group" {
  description = "Log group de CloudWatch con los logs del backend."
  value       = aws_cloudwatch_log_group.backend.name
}

output "ci_deploy_role_arn" {
  description = "ARN del rol que asume el CI de GitHub Actions (secret AWS_DEPLOY_ROLE_ARN)."
  value       = aws_iam_role.ci_deploy.arn
}
