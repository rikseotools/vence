# ============================================================
# Exposición HTTP del backend — Bloque 3 Etapa 2 (Decisión 2026-05-23)
# ============================================================
# ALB público + ACM (DNS validation) + Target Group con healthcheck a /health.
# La zona DNS de vence.es vive en DonDominio (no Route53), por eso los
# records de validación ACM y el A/CNAME final api.vence.es se gestionan
# manualmente fuera de Terraform.
#
# Esta primera versión NO conecta el ECS service al Target Group — eso se
# hace en la sesión de canary /api/medals. El TG queda vacío y el ALB
# devuelve 503 (target_unavailable) hasta entonces. Eso es suficiente para
# validar la cadena DNS+TLS+ALB.
#
# Doc completo: docs/architecture/bloque3-backend-url-pattern.md

# ─── Security group del ALB ────────────────────────────────────
# Acepta 80/443 de cualquier origen. Egress all (necesario para health-check
# desde el ALB al target group y para responder al cliente).
resource "aws_security_group" "alb" {
  name        = "${local.name}-alb-sg"
  description = "Vence backend ALB - ingress 80/443 publico"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTP - solo redirect a HTTPS"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Health check al backend y respuestas"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ─── Regla en el SG del backend para aceptar tráfico del ALB ──
# Sólo el ALB puede llegar al puerto 3000 del backend.
resource "aws_security_group_rule" "backend_from_alb" {
  type                     = "ingress"
  description              = "Permitir trafico del ALB al puerto 3000"
  from_port                = 3000
  to_port                  = 3000
  protocol                 = "tcp"
  security_group_id        = aws_security_group.backend.id
  source_security_group_id = aws_security_group.alb.id
}

# ─── Application Load Balancer ────────────────────────────────
resource "aws_lb" "api" {
  name               = "${local.name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids

  # Drop conexiones inválidas en vez de devolver 4xx — defensa básica.
  drop_invalid_header_fields = true

  # Permitir desactivar deletion_protection si necesitamos destruirlo
  # rápido durante esta fase de bring-up.
  enable_deletion_protection = false

  idle_timeout = 60
}

# ─── Target Group del backend ──────────────────────────────────
# Healthcheck al /health del Nest controller (ya existe en
# backend/src/health/health.controller.ts).
resource "aws_lb_target_group" "backend" {
  name        = "${local.name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = data.aws_vpc.default.id
  target_type = "ip" # Fargate awsvpc → IPs, no instance IDs

  health_check {
    enabled             = true
    path                = "/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # Cuando el deployment del ECS rote la task, dar 30s para drenar
  # conexiones en vuelo antes de matar la antigua.
  deregistration_delay = 30
}

# ─── ACM cert para api.vence.es (DNS validation manual) ───────
# Terraform crea el cert en estado "PendingValidation". Los CNAMEs de
# validación se añaden manualmente en DonDominio (outputs los expone).
# El cert pasa a "Issued" automáticamente cuando AWS detecta los CNAMEs.
# Mientras tanto, el listener HTTPS de abajo lo referencia pero NO sirve
# tráfico TLS válido — los clientes verán error de cert.
resource "aws_acm_certificate" "api" {
  domain_name       = "api.vence.es"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ─── Listener HTTP :80 → redirect a HTTPS ─────────────────────
resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ─── Listener HTTPS :443 → forward al TG ──────────────────────
# ssl_policy: TLS 1.2+ con forward secrecy (recomendado AWS 2024+).
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.api.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
