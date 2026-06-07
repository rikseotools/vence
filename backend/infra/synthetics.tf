# ============================================================
# CloudWatch Synthetics canary — Bloque 5 Fase E.4.4 (2026-05-26)
#
# Canary AWS que ejecuta el flujo crítico de Vence cada 5 min contra
# preview-aws.vence.es. Si falla 2 veces consecutivas → SNS → email a
# admin. Es nuestra primera línea de defensa para detectar caídas 24/7.
#
# Coste estimado: ~$5/mes (12 invocaciones/h × 24h × 30d × $0.0012).
#
# Documentación AWS:
# https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html
# ============================================================

# ============================================================
# S3 bucket para artifacts (screenshots fallo, HAR files)
# ============================================================

resource "aws_s3_bucket" "canary_artifacts" {
  bucket = "vence-canary-artifacts"

  tags = {
    Project   = "vence"
    ManagedBy = "terraform"
    Purpose   = "cloudwatch-synthetics-artifacts"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "canary_artifacts" {
  bucket = aws_s3_bucket.canary_artifacts.id

  rule {
    id     = "expire-old-artifacts"
    status = "Enabled"

    filter {}

    expiration {
      # 30 días suficiente para investigar fallos pasados sin gastar storage.
      days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "canary_artifacts" {
  bucket                  = aws_s3_bucket.canary_artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ============================================================
# IAM execution role para el canary
# ============================================================

resource "aws_iam_role" "canary" {
  name = "vence-canary-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "canary" {
  name = "vence-canary-execution"
  role = aws_iam_role.canary.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ]
        Resource = [
          aws_s3_bucket.canary_artifacts.arn,
          "${aws_s3_bucket.canary_artifacts.arn}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ]
        Resource = "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/cwsyn-*"
      },
      {
        Effect   = "Allow"
        Action   = "cloudwatch:PutMetricData"
        Resource = "*"
        Condition = {
          StringEquals = {
            "cloudwatch:namespace" = "CloudWatchSynthetics"
          }
        }
      },
    ]
  })
}

# ============================================================
# Empaquetar el script en .zip (Synthetics lo exige)
# ============================================================

data "archive_file" "canary_zip" {
  type        = "zip"
  output_path = "${path.module}/.canary-script.zip"

  source {
    content  = file("${path.module}/canary/canary-script.js")
    filename = "nodejs/node_modules/canary.js"
  }
}

# Trigger explícito basado en el hash del zip — fuerza replacement del
# canary cuando cambia el script. Sin esto Terraform solo mira el path
# del zip (que no cambia) y NO actualiza el canary.
resource "terraform_data" "canary_script_hash" {
  triggers_replace = data.archive_file.canary_zip.output_base64sha256
}

# ============================================================
# Canary
# ============================================================

resource "aws_synthetics_canary" "vence_preview" {
  name                 = "vence-preview"
  artifact_s3_location = "s3://${aws_s3_bucket.canary_artifacts.id}/canary-runs/"
  execution_role_arn   = aws_iam_role.canary.arn
  handler              = "canary.handler"
  runtime_version      = "syn-nodejs-puppeteer-15.1"
  start_canary         = true

  zip_file = data.archive_file.canary_zip.output_path

  schedule {
    expression = "rate(5 minutes)"
  }

  run_config {
    timeout_in_seconds = 120
    memory_in_mb       = 1024
    active_tracing     = false
    environment_variables = {
      TARGET_URL = "https://preview-aws.vence.es"
    }
  }

  success_retention_period = 7  # mantener artifacts éxito 7d (debug raro)
  failure_retention_period = 30 # mantener artifacts fallo 30d (investigar)

  tags = {
    Project = "vence"
    Stage   = "preview"
  }

  lifecycle {
    replace_triggered_by = [terraform_data.canary_script_hash]
  }
}

# ============================================================
# SNS topic + suscripción email para alertas
# ============================================================

resource "aws_sns_topic" "canary_alerts" {
  name = "vence-canary-alerts"

  tags = {
    Project = "vence"
  }
}

resource "aws_sns_topic_subscription" "canary_alerts_email" {
  topic_arn = aws_sns_topic.canary_alerts.arn
  protocol  = "email"
  endpoint  = var.admin_email
}

# ============================================================
# CloudWatch alarm — dispara cuando SuccessPercent < 100%
# 2 períodos de 5 min consecutivos sin éxito = canary roto.
# ============================================================

resource "aws_cloudwatch_metric_alarm" "canary_failure" {
  alarm_name          = "vence-canary-preview-failure"
  alarm_description   = "Vence canary preview-aws.vence.es falló 2 ejecuciones consecutivas"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2 # 2 ventanas de 5 min → 10 min de fallos = alarma
  metric_name         = "SuccessPercent"
  namespace           = "CloudWatchSynthetics"
  period              = 300 # 5 min
  statistic           = "Average"
  threshold           = 100 # menos de 100% = al menos 1 fallo en la ventana
  treat_missing_data  = "breaching"

  dimensions = {
    CanaryName = aws_synthetics_canary.vence_preview.name
  }

  alarm_actions = [aws_sns_topic.canary_alerts.arn]
  ok_actions    = [aws_sns_topic.canary_alerts.arn]

  tags = {
    Project = "vence"
  }
}

# ============================================================
# Outputs
# ============================================================

output "canary_name" {
  value = aws_synthetics_canary.vence_preview.name
}

output "canary_artifacts_bucket" {
  value = aws_s3_bucket.canary_artifacts.id
}

output "canary_alerts_topic_arn" {
  value = aws_sns_topic.canary_alerts.arn
}
