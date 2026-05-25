# ============================================================
# Frontend (Next.js) — Bloque 5 Fase E.2 (2026-05-25)
#
# Recursos para el frontend Next.js en ECS Fargate. Comparte cluster con
# el backend NestJS (un solo cluster `vence-backend` ya creado en main.tf).
#
# Estado actual: `desired_count = 0` — sin tráfico. Fase E.2 solo crea los
# recursos. Fase E.3 ampliará a `desired_count = 1` y añadirá ALB rule en
# host preview-aws.vence.es para canary.
#
# Imagen Docker: viene del repo ECR `vence-frontend` (creado fuera de
# Terraform, ver Dockerfile en raíz del repo).
# ============================================================

# ECR repo gestionado fuera de Terraform (recreado puntualmente vía AWS API
# tras los retrocesos SST/ECS). Lo declaramos como `data` para referenciarlo.
data "aws_ecr_repository" "frontend" {
  name = "vence-frontend"
}

# ============================================================
# CloudWatch Logs separados del backend (canal propio para grep)
# ============================================================

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/vence-frontend"
  retention_in_days = var.log_retention_days
}

# ============================================================
# IAM — Execution role (lee secrets SSM al arrancar la task)
# ============================================================

resource "aws_iam_role" "frontend_task_execution" {
  name = "vence-frontend-task-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "frontend_task_execution_managed" {
  role       = aws_iam_role.frontend_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Permiso para leer todos los secretos /vence-frontend/* de SSM.
resource "aws_iam_role_policy" "frontend_task_execution_secrets" {
  name = "vence-frontend-read-secrets"
  role = aws_iam_role.frontend_task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = ["*"]
      }
    ]
  })
}

# ============================================================
# IAM — Task role (permisos de la app en runtime)
# Frontend habla con S3 (storage agnóstico Fase A) → S3 read/write a
# vence-uploads. El bucket policy ya hace público GetObject.
# ============================================================

resource "aws_iam_role" "frontend_task" {
  name = "vence-frontend-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "frontend_task_s3" {
  name = "vence-frontend-s3-uploads"
  role = aws_iam_role.frontend_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::vence-uploads",
          "arn:aws:s3:::vence-uploads/*"
        ]
      }
    ]
  })
}

# ============================================================
# Security group — solo egress
# ============================================================

resource "aws_security_group" "frontend" {
  name        = "vence-frontend-sg"
  description = "Vence frontend ECS - solo egress (sin ingress directo, va por ALB en E.3)"
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "Salida a internet (Supabase, Stripe, etc.)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ============================================================
# Task definition
# ============================================================

resource "aws_ecs_task_definition" "frontend" {
  family                   = "vence-frontend"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  # 0.5 vCPU / 1 GB es suficiente para preview (sin tráfico real).
  # En E.4 si métricas demandan más, se sube a 1 vCPU / 2 GB.
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.frontend_task_execution.arn
  task_role_arn            = aws_iam_role.frontend_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "${data.aws_ecr_repository.frontend.repository_url}:latest"
      essential = true
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "HOSTNAME", value = "0.0.0.0" },
        { name = "TZ", value = "UTC" },
        { name = "NEXT_TELEMETRY_DISABLED", value = "1" },
        # Site URLs: NEXT_PUBLIC_SITE_URL queda inlineado en bundle build-time,
        # pero algunas APIs server-side las leen runtime. SITE_URL es para esos.
        { name = "SITE_URL", value = "https://www.vence.es" },
        { name = "NEXT_PUBLIC_SITE_URL", value = "https://www.vence.es" },
        { name = "EMAIL_FROM_ADDRESS", value = "info@vence.es" },
        { name = "EMAIL_FROM_NAME", value = "Vence.es" },
        { name = "VAPID_EMAIL", value = "info@vence.es" },
        { name = "PAUSE_MOTIVATIONAL_EMAILS", value = "true" },
        { name = "AWS_S3_BUCKET", value = "vence-uploads" },
        { name = "AWS_S3_REGION", value = var.aws_region },
        { name = "STORAGE_PROVIDER", value = "s3" },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/DATABASE_URL" },
        { name = "DATABASE_URL_REPLICA", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/DATABASE_URL_REPLICA" },
        { name = "SUPABASE_SERVICE_ROLE_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/SUPABASE_SERVICE_ROLE_KEY" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/STRIPE_SECRET_KEY" },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/STRIPE_WEBHOOK_SECRET" },
        { name = "RESEND_API_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/RESEND_API_KEY" },
        { name = "RESEND_WEBHOOK_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/RESEND_WEBHOOK_SECRET" },
        { name = "ANTHROPIC_API_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/ANTHROPIC_API_KEY" },
        { name = "CRON_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/CRON_SECRET" },
        { name = "OBSERVABILITY_INGEST_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/OBSERVABILITY_INGEST_SECRET" },
        { name = "VAPID_PRIVATE_KEY", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/VAPID_PRIVATE_KEY" },
        { name = "SUPABASE_WEBHOOK_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/SUPABASE_WEBHOOK_SECRET" },
        { name = "ARMANDO_PASSWORD_SHA256", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/ARMANDO_PASSWORD_SHA256" },
        { name = "ARMANDO_SESSION_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/ARMANDO_SESSION_SECRET" },
        { name = "META_ACCESS_TOKEN", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/META_ACCESS_TOKEN" },
        { name = "META_PIXEL_ID", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/META_PIXEL_ID" },
        { name = "EMAIL_CRON_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/EMAIL_CRON_SECRET" },
        { name = "UPSTASH_REDIS_REST_URL", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/UPSTASH_REDIS_REST_URL" },
        { name = "UPSTASH_REDIS_REST_TOKEN", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/UPSTASH_REDIS_REST_TOKEN" },
        { name = "GOOGLE_CLIENT_SECRET", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/GOOGLE_CLIENT_SECRET" },
      ]
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])
}

# ============================================================
# ECS service — DESIRED=0 (sin tráfico aún, Fase E.2)
# ============================================================

resource "aws_ecs_service" "frontend" {
  name            = "vence-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 0 # Fase E.2: sin tráfico. E.3 sube a 1 + ALB rule.
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.frontend.id]
    assign_public_ip = true # ya estás en subred pública, sin NAT gateway
  }

  # E.3 añadirá load_balancer block con target group del frontend.

  # El CI actualiza la imagen vía `update-service --force-new-deployment`;
  # no dejar que Terraform revierta el tag desplegado.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}

# ============================================================
# ci-deploy permisos para frontend ECR + ECS update
# El role aws_iam_role.ci_deploy ya existe (definido en main.tf para backend).
# Su policy fue actualizada vía AWS API directa para incluir vence-frontend
# ECR; aquí declaramos también la dependencia desde Terraform para que
# `terraform plan` sea consciente del estado real.
# ============================================================
