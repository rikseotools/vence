variable "aws_region" {
  description = "Región AWS. eu-west-2 (Londres) — co-localizada con la BD Supabase."
  type        = string
  default     = "eu-west-2"
}

variable "project" {
  description = "Nombre del proyecto, prefijo de los recursos."
  type        = string
  default     = "vence-backend"
}

variable "image_tag" {
  description = "Tag de la imagen del contenedor a desplegar."
  type        = string
  default     = "latest"
}

variable "cpu" {
  description = "CPU de la task Fargate (256 = 0.25 vCPU)."
  type        = number
  default     = 256
}

variable "memory" {
  description = "Memoria de la task Fargate en MB."
  type        = number
  default     = 512
}

variable "log_retention_days" {
  description = "Retención de los logs en CloudWatch."
  type        = number
  default     = 30
}

variable "log_level" {
  description = "Nivel de log de la app."
  type        = string
  default     = "log"
}

variable "app_base_url" {
  description = "URL de la app Next.js (para el endpoint de email de admin)."
  type        = string
  default     = "https://www.vence.es"
}

variable "admin_email" {
  description = "Email del admin para los avisos de cambios BOE."
  type        = string
  default     = "manueltrader@gmail.com"
}

variable "boe_notify_enabled" {
  description = "Enviar emails de cambios BOE. Mantener \"false\" mientras el cron corre en shadow."
  type        = string
  default     = "false"
}

variable "database_url_ssm_name" {
  description = "Nombre del parámetro SSM (SecureString) con la DATABASE_URL. Se crea fuera de Terraform (ver infra/README.md)."
  type        = string
  default     = "/vence-backend/DATABASE_URL"
}

variable "pooler_target_group_arn" {
  description = "ARN del target group del NLB del pooler PgBouncer. El cron pooler-instance-sampler lo usa (DescribeTargetHealth) para descubrir las instancias dinámicamente."
  type        = string
  default     = "arn:aws:elasticloadbalancing:eu-west-2:349744179687:targetgroup/vence-pooler-tg/c9946622d4e38dfe"
}

variable "cron_secret_ssm_name" {
  description = "Nombre del parámetro SSM (SecureString) con el CRON_SECRET (token Bearer para endpoints internos de la app). Se crea fuera de Terraform."
  type        = string
  default     = "/vence-backend/CRON_SECRET"
}

variable "github_repo" {
  description = "Repo GitHub (owner/name) autorizado a desplegar vía OIDC."
  type        = string
  default     = "rikseotools/vence"
}
