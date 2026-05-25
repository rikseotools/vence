data "aws_caller_identity" "current" {}

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

locals {
  name = var.project
  # ARNs de los parámetros SSM con los secretos (se crean fuera de Terraform —
  # ver infra/README.md — para que el secreto NO entre en el estado de TF).
  database_url_ssm_arn         = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.database_url_ssm_name}"
  cron_secret_ssm_arn          = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.cron_secret_ssm_name}"
  upstash_url_ssm_arn          = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/UPSTASH_REDIS_REST_URL"
  upstash_token_ssm_arn        = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/UPSTASH_REDIS_REST_TOKEN"
  resend_api_key_ssm_arn       = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/RESEND_API_KEY"
  email_from_name_ssm_arn      = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/EMAIL_FROM_NAME"
  email_from_address_ssm_arn   = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/EMAIL_FROM_ADDRESS"
  supabase_jwt_secret_ssm_arn  = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/SUPABASE_JWT_SECRET"
  admin_alerts_email_ssm_arn   = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/ADMIN_ALERTS_EMAIL"
  sentry_dsn_ssm_arn           = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-backend/SENTRY_DSN"
}

# ============================================================
# ECR — registro de la imagen Docker
# ============================================================

resource "aws_ecr_repository" "backend" {
  name                 = local.name
  image_tag_mutability = "MUTABLE"
  image_scanning_configuration {
    scan_on_push = true
  }
}

# Conservar solo las últimas 10 imágenes (higiene de coste/espacio).
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Conservar solo las ultimas 10 imagenes"
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
# CloudWatch Logs
# ============================================================

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name}"
  retention_in_days = var.log_retention_days
}

# ============================================================
# IAM — roles de la task
# ============================================================

# Rol de EJECUCIÓN: lo asume el agente de ECS para arrancar la task
# (pull de la imagen, escribir logs, resolver secretos de SSM).
resource "aws_iam_role" "task_execution" {
  name = "${local.name}-task-execution"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "task_execution_managed" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Permiso para leer el secreto DATABASE_URL de SSM al arrancar la task.
resource "aws_iam_role_policy" "task_execution_secrets" {
  name = "${local.name}-read-secrets"
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["ssm:GetParameters"]
        Resource = [
          local.database_url_ssm_arn,
          local.cron_secret_ssm_arn,
          local.upstash_url_ssm_arn,
          local.upstash_token_ssm_arn,
          local.resend_api_key_ssm_arn,
          local.email_from_name_ssm_arn,
          local.email_from_address_ssm_arn,
          local.admin_alerts_email_ssm_arn,
          local.supabase_jwt_secret_ssm_arn,
          local.sentry_dsn_ssm_arn,
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = ["*"] # clave gestionada por AWS para SSM SecureString
      }
    ]
  })
}

# Rol de la TASK: permisos de la propia app en ejecución.
# Etapa 1: la app solo habla con Postgres y el BOE por red — sin permisos AWS.
resource "aws_iam_role" "task" {
  name = "${local.name}-task"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# ============================================================
# Red — security group del worker
# ============================================================

# Worker sin endpoint público: sin reglas de entrada, solo salida
# (necesita egress para llegar a Supabase, al BOE, a ECR y a CloudWatch).
resource "aws_security_group" "backend" {
  name        = "${local.name}-sg"
  description = "Vence backend worker - solo salida"
  vpc_id      = data.aws_vpc.default.id

  egress {
    description = "Salida a internet"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ============================================================
# ECS — cluster, task definition y servicio (Fargate)
# ============================================================

resource "aws_ecs_cluster" "main" {
  name = local.name
}

resource "aws_ecs_task_definition" "backend" {
  family                   = local.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"
      essential = true
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "LOG_LEVEL", value = var.log_level },
        { name = "APP_BASE_URL", value = var.app_base_url },
        { name = "ADMIN_EMAIL", value = var.admin_email },
        { name = "BOE_NOTIFY_ENABLED", value = var.boe_notify_enabled },
        { name = "TZ", value = "UTC" },
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = local.database_url_ssm_arn },
        { name = "CRON_SECRET", valueFrom = local.cron_secret_ssm_arn },
        { name = "UPSTASH_REDIS_REST_URL", valueFrom = local.upstash_url_ssm_arn },
        { name = "UPSTASH_REDIS_REST_TOKEN", valueFrom = local.upstash_token_ssm_arn },
        { name = "RESEND_API_KEY", valueFrom = local.resend_api_key_ssm_arn },
        { name = "EMAIL_FROM_NAME", valueFrom = local.email_from_name_ssm_arn },
        { name = "EMAIL_FROM_ADDRESS", valueFrom = local.email_from_address_ssm_arn },
        { name = "SUPABASE_JWT_SECRET", valueFrom = local.supabase_jwt_secret_ssm_arn },
        { name = "ADMIN_ALERTS_EMAIL", valueFrom = local.admin_alerts_email_ssm_arn },
        { name = "SENTRY_DSN", valueFrom = local.sentry_dsn_ssm_arn },
      ]
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.backend.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "backend" {
  name            = local.name
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = true # subred pública por defecto, sin NAT gateway
  }

  # Bloque 3 canary — conectar el service al TG del ALB. El healthcheck
  # del TG llama a /health del Nest cada 30s. Si la task pasa 2 chequeos
  # consecutivos OK, queda registrada como target sano y empieza a recibir
  # tráfico HTTP del ALB.
  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 3000
  }

  # Grace period para que la task arranque y el healthcheck pase antes de
  # que el deployment controller la marque como unhealthy. NestJS arranca
  # en ~5-10s, damos 60s de margen.
  health_check_grace_period_seconds = 60

  # El CI actualiza la imagen vía `update-service --force-new-deployment`;
  # no dejar que Terraform revierta el tag desplegado.
  lifecycle {
    ignore_changes = [task_definition]
  }
}

# ============================================================
# GitHub Actions OIDC — despliegue sin claves AWS de larga vida
# ============================================================

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# Rol que asume el workflow de CI para construir y desplegar.
resource "aws_iam_role" "ci_deploy" {
  name = "${local.name}-ci-deploy"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:${var.github_repo}:*"
        }
      }
    }]
  })
}

resource "aws_iam_role_policy" "ci_deploy" {
  name = "${local.name}-ci-deploy"
  role = aws_iam_role.ci_deploy.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:CompleteLayerUpload",
          "ecr:InitiateLayerUpload",
          "ecr:PutImage",
          "ecr:UploadLayerPart",
          "ecr:BatchGetImage",
          "ecr:GetDownloadUrlForLayer"
        ]
        Resource = [aws_ecr_repository.backend.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["ecs:UpdateService", "ecs:DescribeServices"]
        Resource = [aws_ecs_service.backend.id]
      }
    ]
  })
}
