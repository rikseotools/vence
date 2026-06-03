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

# Resuelve el SHA actual del tag `:latest` en ECR. Usado para pinear el
# image digest en la task definition al hacer terraform apply — evita el
# anti-patrón "service pinea SHA al arrancar y crashloop si lifecycle policy
# purga ese SHA cacheado mientras :latest avanza". Postmortem #115.
#
# Cada terraform apply re-resuelve :latest y registra nueva task def
# revision con ese digest específico. El GHA frontend-deploy.yml hace lo
# mismo en cada push para mantener consistencia.
data "aws_ecr_image" "frontend_latest" {
  repository_name = data.aws_ecr_repository.frontend.name
  image_tag       = "latest"
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
  # Postmortem incidente 2026-05-26 14:50-15:10 (task #117): 0.5 vCPU + 1 GB
  # no aguanta SSR concurrente real. Memoria subía 71%→99.8% en 30 min bajo
  # carga normal (Vencé sirve ~500 rutas SSG + queries Supabase desde un único
  # proceso Node; en Vercel cada request era una lambda aislada).
  # Subido a 1 vCPU / 2 GB. Combinado con autoscaling (más abajo) y fix del
  # leak en LawsAPI (pendiente, task #117) cubre el rango objetivo a 10k DAU.
  cpu                = "1024"
  memory             = "2048"
  execution_role_arn = aws_iam_role.frontend_task_execution.arn
  task_role_arn      = aws_iam_role.frontend_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name = "frontend"
      # Pinear por DIGEST (no tag mutable `:latest`). Causa raíz del incidente
      # 2026-05-26 14:50: ECS había pineado el SHA cacheado al arrancar el
      # servicio; cuando lifecycle policy de ECR purgó ese SHA, los restarts
      # post-OOM caían en CannotPullContainerError loop.
      #
      # Tanto terraform apply como GHA frontend-deploy.yml pinean por digest
      # explícito. Cualquier task que arranque SIEMPRE encuentra su imagen
      # en ECR porque el digest se resolvió en el deploy más reciente.
      image     = "${data.aws_ecr_repository.frontend.repository_url}@${data.aws_ecr_image.frontend_latest.image_digest}"
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
        # Feature flag boolean — Fase D-bis Iter 1.5 (31/05/2026). En SSM (no
        # env var) para flip rápido sin terraform: ssm put-parameter --value
        # false → force-new-deployment para rollback en ~3 min.
        { name = "TOPIC_MV_ENABLED", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/TOPIC_MV_ENABLED" },
        # Fase 1 pool-segregation (01/06/2026): activar self-hosted PgBouncer
        # (pooler.vence.es) como pool principal. Si flag=false → fallback al
        # Supavisor regional. Rollback en ~3 min via SSM update + force-new-deployment.
        { name = "USE_SELF_HOSTED_POOLER", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/USE_SELF_HOSTED_POOLER" },
        # DSN del self-hosted PgBouncer en Lightsail London (Fase 6 HA: 2 VMs
        # detrás de NLB, ver self-hosted-pooler.md). Mismo password que
        # DATABASE_URL (SCRAM passthrough en PgBouncer).
        { name = "DATABASE_URL_SELF_POOLER", valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/vence-frontend/DATABASE_URL_SELF_POOLER" },
      ]
      # Container-level healthCheck (Fase 1 pool-segregation, 01/06/2026).
      # ECS solo marca el container `ready` cuando wget al endpoint devuelve
      # JSON con "ok":true (i.e. pool DB establecido y SELECT 1 < 2s). Sin
      # esto, el container con pool cold-start recibiría tráfico → cascada 5xx.
      # startPeriod=60s da margen al warmup robusto en createPoolerDbClient
      # (3 SELECT 1 paralelos al boot).
      healthCheck = {
        command = [
          "CMD-SHELL",
          "wget -qO- --tries=1 --timeout=4 http://localhost:3000/api/health/db-ready > /tmp/hc.json 2>/dev/null && grep -q '\"ok\":true' /tmp/hc.json || exit 1",
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
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
# ALB target group + listener rule (Fase E.3)
# Reusa el ALB existente del backend; añade host-based rule para que
# `preview-aws.vence.es` route al service frontend.
# ============================================================

# ACM cert para preview-aws.vence.es (creado fuera de Terraform via AWS CLI
# en E.3, validado vía DNS). Declarado como data para referenciarlo.
data "aws_acm_certificate" "preview_aws" {
  domain      = "preview-aws.vence.es"
  statuses    = ["ISSUED"]
  most_recent = true
}

# ALB ya existente del backend. Lo referenciamos.
data "aws_lb" "main" {
  name = "vence-backend-alb"
}

data "aws_lb_listener" "https" {
  load_balancer_arn = data.aws_lb.main.arn
  port              = 443
}

resource "aws_lb_target_group" "frontend" {
  name        = "vence-frontend-tg"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip" # Fargate awsvpc → IPs, no instance IDs
  vpc_id      = data.aws_vpc.default.id

  # Health check apunta al endpoint que verifica el pool BD (Fase 1
  # pool-segregation, 01/06/2026). Antes era "/" (ping superficial del
  # Next.js — devolvía 200 con pool muerto). Ahora ALB solo marca el
  # target healthy si /api/health/db-ready devuelve 200 (pool establecido
  # y SELECT 1 < 2s).
  health_check {
    enabled             = true
    path                = "/api/health/db-ready"
    protocol            = "HTTP"
    matcher             = "200" # estricto: 503 → unhealthy inmediato
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30
  # Slow start: cuando un target nuevo pasa a healthy, recibe tráfico
  # gradualmente durante 30s en vez de full speed (Fase 1
  # pool-segregation). Da más margen al warmup del pool.
  slow_start = 30
}

# Anexar el cert preview-aws.vence.es al listener :443 existente (SNI).
# El listener default cert sigue siendo api.vence.es; este es additional.
resource "aws_lb_listener_certificate" "preview_aws" {
  listener_arn    = data.aws_lb_listener.https.arn
  certificate_arn = data.aws_acm_certificate.preview_aws.arn
}

# Listener rule: routea al frontend ECS para todos los hostnames que sirve
# el frontend (preview-aws + www + apex). E.6 cutover (2026-05-26) amplió
# de solo preview-aws a los 3 para que CloudFront pueda usar www.vence.es
# como alias.
resource "aws_lb_listener_rule" "frontend_preview" {
  listener_arn = data.aws_lb_listener.https.arn
  priority     = 110 # priority bajo = más prioritario; backend usa 100.

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }

  condition {
    host_header {
      values = ["preview-aws.vence.es", "www.vence.es", "vence.es"]
    }
  }
}

# Permitir que el ALB hable con las tasks frontend en puerto 3000.
resource "aws_security_group_rule" "frontend_from_alb" {
  type                     = "ingress"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.frontend.id
  source_security_group_id = data.aws_security_group.alb.id
  description              = "ALB to frontend tasks"
}

# SG del ALB (creado fuera de TF en otro stage del proyecto).
data "aws_security_group" "alb" {
  filter {
    name   = "group-name"
    values = ["vence-backend-alb-sg"]
  }
  vpc_id = data.aws_vpc.default.id
}

# ============================================================
# CloudFront distribution (Fase E.5)
# ============================================================
# Edge cache global delante del ALB. Hace dos cosas críticas:
#   1. Cache de estáticos /_next/static/* en edge → first paint <100ms.
#   2. Cache de páginas con Cache-Control de Next.js (ISR) → reduce carga ECS.
#
# Cert ACM en us-east-1 (CloudFront NO acepta otra región).
# Provider explícito para us-east-1.
# ============================================================

# Provider us-east-1 solo para resolver el cert de CloudFront.
# El profile lo toma del entorno (AWS_PROFILE=vence cuando se ejecuta terraform).
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_acm_certificate" "cloudfront_preview" {
  provider    = aws.us_east_1
  domain      = "preview-aws.vence.es"
  statuses    = ["ISSUED"]
  most_recent = true
}

# Cert wildcard *.vence.es + vence.es (E.6 cutover). Cubre preview-aws,
# www, api, auth, etc. Reemplaza al cert preview-aws en CloudFront cuando
# añadimos www como alias.
data "aws_acm_certificate" "cloudfront_wildcard" {
  provider    = aws.us_east_1
  domain      = "vence.es"
  statuses    = ["ISSUED"]
  most_recent = true
}

# Cache policies. Reusamos las managed por AWS donde aplica.
# - Managed-CachingOptimized:      cache forever respetando ETag (estáticos)
# - Managed-CachingDisabled:       no cache (APIs)
# - Custom para SSG/ISR (mira Cache-Control del origin)
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Para el default (SSR/ISR): respect Cache-Control del origin, TTL razonable.
resource "aws_cloudfront_cache_policy" "frontend_default" {
  name        = "vence-frontend-default"
  default_ttl = 60 # 1 min si origin no devuelve Cache-Control
  min_ttl     = 0
  max_ttl     = 86400 # 1 día si origin pide más
  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "all" # cookies de sesión pueden afectar render
    }
    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["host", "accept", "accept-language", "user-agent"]
      }
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true
  }
}

# Origin request policy: pasar host header al ALB (necesario para que el
# listener rule matchee preview-aws.vence.es y vaya al TG correcto).
data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# CloudFront Function (viewer-request): redirige el apex vence.es → www.vence.es
# (301, preservando path + querystring). Mantiene el comportamiento que hacía
# Vercel (apex 308→www) ahora que el apex pasa por CloudFront, para no romper el
# canonical SEO (que apunta a www). Solo actúa en host == "vence.es"; www y
# preview-aws pasan sin tocar.
resource "aws_cloudfront_function" "apex_redirect" {
  name    = "vence-apex-to-www"
  runtime = "cloudfront-js-2.0"
  comment = "Redirige vence.es (apex) -> www.vence.es (301), preserva path+query"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var request = event.request;
      var host = request.headers.host && request.headers.host.value;
      if (host === 'vence.es') {
        var qs = '';
        var keys = request.querystring ? Object.keys(request.querystring) : [];
        if (keys.length) {
          qs = '?' + keys.map(function (k) {
            var v = request.querystring[k].value;
            return v ? k + '=' + v : k;
          }).join('&');
        }
        return {
          statusCode: 301,
          statusDescription: 'Moved Permanently',
          headers: { location: { value: 'https://www.vence.es' + request.uri + qs } }
        };
      }
      return request;
    }
  EOT
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled         = true
  is_ipv6_enabled = true
  http_version    = "http2and3"
  comment         = "Vence frontend preview (Fase E.5)"
  price_class     = "PriceClass_100" # USA + EU. Suficiente para España.

  # E.6 cutover (2026-05-26): añadidos www.vence.es y vence.es como
  # aliases junto al preview-aws original. Misma distribution sirve los
  # 3 hostnames. Cert wildcard ACM us-east-1 cubre todos.
  aliases = ["preview-aws.vence.es", "www.vence.es", "vence.es"]

  origin {
    domain_name = data.aws_lb.main.dns_name
    origin_id   = "vence-alb-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60 # SSR Next puede tardar en cold
    }
  }

  # Default behavior: SSR/ISR. TTL corto, respect Cache-Control.
  default_cache_behavior {
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "vence-alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.frontend_default.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id

    # Redirige apex vence.es → www.vence.es (el resto pasa sin tocar).
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.apex_redirect.arn
    }
  }

  # /_next/static/* — assets versionados, cache forever.
  ordered_cache_behavior {
    path_pattern             = "/_next/static/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "vence-alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # /_next/image/* — Next.js Image Optimization. Cache 24h (key con qs).
  ordered_cache_behavior {
    path_pattern             = "/_next/image*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "vence-alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # /api/* — sin cache, passthrough.
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "vence-alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  viewer_certificate {
    # E.6 cutover: usar cert wildcard que cubre preview-aws, www, apex, etc.
    acm_certificate_arn      = data.aws_acm_certificate.cloudfront_wildcard.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Project = "vence-frontend"
    Stage   = "preview"
  }
}

# ============================================================
# ECS service — Fase E.3: desired=1 + load_balancer
# ============================================================

resource "aws_ecs_service" "frontend" {
  name            = "vence-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  # Fase 1 pool-segregation (01/06/2026): desired_count = 2 garantiza que
  # nunca quede solo 1 task durante un rolling deploy. Con 1 task la
  # ventana de "container nuevo arrancando + viejo drenando" causaba
  # cascada de 5xx (Hipótesis D). Min capacity del autoscaling también
  # subido a 2 (más abajo) para que scaling-in no pueda bajar de aquí.
  desired_count = 2
  launch_type   = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.frontend.id]
    assign_public_ip = true # subred pública, sin NAT gateway
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }

  health_check_grace_period_seconds = 90 # Next.js arranca en ~5-10s, margen amplio

  # Permitir que ECS revierta automáticamente si el task nuevo no pasa el
  # healthcheck del ALB. Evita downtime por bad deploys (img mal compilada,
  # env var roto, OOM en arranque, etc.).
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Terraform es dueño del task_definition (pinea por digest en cada apply).
  # El GHA en cada push también registra nueva revision; el drift es
  # menor (revision number) y converge en el siguiente apply porque ambos
  # resuelven al digest actual de `:latest`.
  #
  # `desired_count` SÍ se ignora — autoscaling lo controla (1→3 por CPU/mem).
  lifecycle {
    ignore_changes = [desired_count]
  }

  # No arrancar el service hasta que la rule del ALB exista — si no, la task
  # pasa el healthcheck pero no recibe tráfico.
  depends_on = [aws_lb_listener_rule.frontend_preview]
}

# ============================================================
# ci-deploy permisos para frontend ECR + ECS update
# El role aws_iam_role.ci_deploy ya existe (definido en main.tf para backend).
# Su policy fue actualizada vía AWS API directa para incluir vence-frontend
# ECR; aquí declaramos también la dependencia desde Terraform para que
# `terraform plan` sea consciente del estado real.
# ============================================================

# ============================================================
# Autoscaling — Bloque 5 Fase E post-incidente OOM 2026-05-26 (#117)
#
# Un solo task con 1 vCPU + 2 GB no aguanta picos de tráfico SSR si hay
# memory leak en código (LawsAPI cache reinicializa por request, leak
# vivo a fecha 26/05). Autoscale 1→3 por CPU o memoria:
#  - target_value=70 CPU/75 mem: ECS lanza task adicional cuando uno
#    supera el umbral 3 min sostenido. Drena en 5 min cuando baja.
#  - max 3 tasks: capacidad para ~30k DAU con holgura. Si llegamos a 3
#    sostenidos, hay que investigar (no autoscalar más sin diagnóstico).
#
# Coste: ~$15/task/mes × 0-2 tasks extra. Promedio ~$10-20/mes adicional.
# ============================================================

resource "aws_appautoscaling_target" "frontend" {
  max_capacity = 3
  # Fase 1 pool-segregation (01/06/2026): min_capacity = 2 obligatorio.
  # Cuando estaba a 1, en horas de bajo tráfico autoscaling bajaba de 2 a
  # 1, dejando una sola task. El siguiente rolling deploy con 1 task = 0
  # tasks healthy durante la ventana del swap = 5xx cascada para usuarios
  # reales. Coste extra ($15/task/mes × 1 task = $15) << coste reputacional
  # de downtime.
  min_capacity       = 2
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.frontend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

# Scale-out por CPU.
resource "aws_appautoscaling_policy" "frontend_cpu" {
  name               = "vence-frontend-cpu-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.frontend.resource_id
  scalable_dimension = aws_appautoscaling_target.frontend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.frontend.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

# Scale-out por memoria (más crítico hoy por el leak).
resource "aws_appautoscaling_policy" "frontend_memory" {
  name               = "vence-frontend-memory-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.frontend.resource_id
  scalable_dimension = aws_appautoscaling_target.frontend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.frontend.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value       = 75.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}
