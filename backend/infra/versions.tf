terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # ════════════════════════════════════════════════════════════════════
  # Remote state — S3 + DynamoDB lock (Fase IaC 6.x, 2026-06-01)
  # ════════════════════════════════════════════════════════════════════
  # Motivación (incidente 2026-06-01): hasta hoy el state vivía en local
  # `terraform.tfstate`. Cuando varias sesiones (claude-cli paralelas,
  # GHA workflows, devs) hacían `terraform apply` sin coordinarse:
  #   - Una sesión sin los cambios pendientes hacía apply
  #   - Revertía silenciosamente cambios pendientes de otra
  #   - Detectado al ver que el HealthCheckPath del target group volvió
  #     de /api/health/db-ready a / sin que nadie lo cambiara explícitamente.
  #
  # Solución profesional estándar:
  #   - State en S3 con versioning + encryption (rollback granular).
  #   - Lock vía DynamoDB (un solo apply concurrent).
  #   - Bucket name con account-id sufijo (S3 namespace global).
  #
  # Infra del backend (NO gestionada por este Terraform — chicken-and-egg):
  #   - S3 bucket:    vence-terraform-state-349744179687
  #     (versioning + AES256 + block-public-access)
  #   - DynamoDB:     vence-terraform-locks (PAY_PER_REQUEST, key LockID)
  #
  # Migración del state local → remoto: 2026-06-01.
  # Backup del state local original: terraform.tfstate.local-backup (NO commitear).
  backend "s3" {
    bucket         = "vence-terraform-state-349744179687"
    key            = "vence/backend/terraform.tfstate"
    region         = "eu-west-2"
    encrypt        = true
    dynamodb_table = "vence-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}
