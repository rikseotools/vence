# ============================================================
# Lambda Headless Fetcher — Fase 1 roadmap deteccion-convocatorias-oeps-completo.md
#
# Función AWS Lambda que renderiza páginas JS-rendered con Playwright + Chromium
# headless. El backend NestJS la invoca síncronamente para obtener HTML
# post-hydration de portales SPA (Aytos, CCAA, etc.) que el `fetchPageHtml`
# nativo del backend no puede procesar.
#
# 26 oposiciones del catálogo activo (57.8%) dependen de esta capa según el
# audit Fase 0 (docs/maintenance/audit-seguimiento-coverage.md).
#
# Coste estimado primer año: $0 (free tier cubre 1M req/mes + 400k GB-seg).
# Volumen previsto: 26 oposiciones × 4 fetch/día = 3.120 invocaciones/mes.
# CloudWatch logs marginales (~$1/mes a partir de 30d retención).
#
# Documentación AWS:
# https://docs.aws.amazon.com/lambda/latest/dg/configuration-images.html
# ============================================================

# ============================================================
# ECR repository para la imagen de la Lambda
# ============================================================

resource "aws_ecr_repository" "headless_fetcher" {
  name                 = "vence-headless-fetcher"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Project   = var.project
    ManagedBy = "terraform"
    Purpose   = "lambda-headless-fetcher"
  }
}

resource "aws_ecr_lifecycle_policy" "headless_fetcher" {
  repository = aws_ecr_repository.headless_fetcher.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Mantener solo las últimas 10 imágenes"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 10
      }
      action = { type = "expire" }
    }]
  })
}

# ============================================================
# IAM execution role
# ============================================================

resource "aws_iam_role" "headless_fetcher" {
  name = "${var.project}-headless-fetcher"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Project   = var.project
    ManagedBy = "terraform"
  }
}

# Política mínima: solo CloudWatch logs (sin acceso a S3, secretos, etc.).
# Si en el futuro se requiere fetch de páginas privadas con auth, añadir aquí
# permisos para leer credenciales de SSM/Secrets Manager.
resource "aws_iam_role_policy_attachment" "headless_fetcher_logs" {
  role       = aws_iam_role.headless_fetcher.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# ============================================================
# CloudWatch log group
# ============================================================

resource "aws_cloudwatch_log_group" "headless_fetcher" {
  name              = "/aws/lambda/${var.project}-headless-fetcher"
  retention_in_days = var.log_retention_days

  tags = {
    Project   = var.project
    ManagedBy = "terraform"
  }
}

# ============================================================
# Lambda function (container image)
#
# El image_uri apunta a `:latest` del ECR repo. La primera vez que se ejecuta
# `terraform apply`, el repo todavía no tiene imagen subida → la creación de la
# Lambda fallará. Bootstrap:
#
#   1. `terraform apply -target=aws_ecr_repository.headless_fetcher`
#   2. Build + push manual de la imagen (ver headless-fetcher/README.md)
#   3. `terraform apply` (completo)
#
# Tras el bootstrap, los siguientes deploys se hacen vía CI/CD: push nueva
# imagen al ECR + `aws lambda update-function-code --image-uri ...`.
# ============================================================

resource "aws_lambda_function" "headless_fetcher" {
  function_name = "${var.project}-headless-fetcher"
  role          = aws_iam_role.headless_fetcher.arn

  package_type = "Image"
  image_uri    = "${aws_ecr_repository.headless_fetcher.repository_url}:latest"

  # 2048 MB necesarios para Chromium + Playwright. El audit Fase 0 confirma
  # que el handler procesa páginas SPA con bundle de hasta 3 MB sin OOM.
  memory_size = 2048

  # 60s soft timeout. Páginas estáticas tardan 2-5s; SPAs con redirects y
  # carga lazy hasta 15-20s. Margen suficiente sin acumular fetches colgados.
  timeout = 60

  environment {
    variables = {
      # Telemetría a observable_events vía HTTP al backend (no creamos
      # dependencia AWS extra — Lambda hace POST simple).
      OBSERVABILITY_INGEST_URL = "${var.app_base_url}/api/observability/ingest"
      LOG_LEVEL                = var.log_level
    }
  }

  # Cuando Terraform crea la función, AWS necesita la imagen ya en ECR.
  # Si no está, el apply falla y hay que seguir el bootstrap del README.
  depends_on = [
    aws_cloudwatch_log_group.headless_fetcher,
    aws_iam_role_policy_attachment.headless_fetcher_logs,
  ]

  # Evitar que Terraform pisotee la image_uri cuando CI/CD actualiza la imagen.
  # El deploy de código va por CI, Terraform solo gestiona infra estable.
  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Project   = var.project
    ManagedBy = "terraform"
    Purpose   = "headless-browser-fetch"
  }
}

# ============================================================
# AWS Budget alert: notificar si el coste mensual de esta Lambda supera $20
# ============================================================

resource "aws_budgets_budget" "headless_fetcher" {
  name              = "${var.project}-headless-fetcher-monthly"
  budget_type       = "COST"
  limit_amount      = "20"
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2026-06-01_00:00"

  cost_filter {
    name = "TagKeyValue"
    values = [
      "user:Purpose$headless-browser-fetch",
    ]
  }

  # Alerta al 80% del presupuesto (=$16 gastados de $20).
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.admin_email]
  }

  # Alerta forecasted al 100% (proyección del mes).
  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.admin_email]
  }
}

# ============================================================
# Permission: permitir que el backend NestJS (rol task ECS) invoque la Lambda.
# Sin esto, el SDK AWS desde el backend recibe AccessDenied.
# ============================================================

resource "aws_iam_role_policy" "backend_invoke_headless_fetcher" {
  name = "${var.project}-invoke-headless-fetcher"
  role = aws_iam_role.task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "lambda:InvokeFunction"
      Resource = aws_lambda_function.headless_fetcher.arn
    }]
  })
}
