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

# ============================================================
# Outputs ALB / DNS (Bloque 3 — exposición HTTP del backend)
# ============================================================

output "alb_dns_name" {
  description = "DNS name del ALB. Añadir CNAME 'api' → este valor en DonDominio."
  value       = aws_lb.api.dns_name
}

output "alb_zone_id" {
  description = "Hosted zone ID del ALB (por si en el futuro la zona vence.es migra a Route53)."
  value       = aws_lb.api.zone_id
}

output "acm_certificate_arn" {
  description = "ARN del cert ACM para api.vence.es."
  value       = aws_acm_certificate.api.arn
}

output "acm_validation_records" {
  description = "CNAMEs de validación que hay que añadir en DonDominio para que ACM valide el cert. Una vez añadidos, AWS detecta y el cert pasa a 'Issued' en <5 min."
  value = [
    for opt in aws_acm_certificate.api.domain_validation_options : {
      name  = opt.resource_record_name
      type  = opt.resource_record_type
      value = opt.resource_record_value
    }
  ]
}

output "dondominio_setup_instructions" {
  description = "Instrucciones humanas resumidas para añadir los records en DonDominio."
  value = <<-EOT

    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    Añadir EN DONDOMINIO (Dominios → vence.es → Zona DNS):

    1) CNAME de validación ACM:
       Ver acm_validation_records arriba (nombre y valor).

    2) CNAME del subdominio público:
       Nombre  → api
       Tipo    → CNAME
       Valor   → ${aws_lb.api.dns_name}

    Tras añadirlos, esperar 5-15 min para propagación. Verificar con:
       dig api.vence.es CNAME
       curl -v https://api.vence.es/health
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EOT
}
