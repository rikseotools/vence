# ============================================================
# Self-hosted PgBouncer HA — Fase 6 pool-segregation (2026-06-01)
# ============================================================
# Self-hosted pooler con 2 VMs Lightsail (eu-west-2a + eu-west-2b) detrás
# de un AWS NLB. Reemplaza el SPOF de la única VM Lightsail eu-west-2a que
# existía hasta 2026-06-01 09:30 UTC.
#
# Arquitectura completa: docs/roadmap/self-hosted-pooler.md (Fase 6) +
# docs/roadmap/pool-segregation.md (Fase 6 documentada como HA).
#
# Recursos importados desde el AWS API (creados a mano vía aws cli durante
# Fase 6 HA, 2026-06-01 ~09:30-09:35 UTC). El `terraform import` los trae
# al state remoto S3; futuros cambios pasarán por Terraform.
#
# NOTA — VPC peering Lightsail ↔ default VPC:
# NO se declara como recurso TF. La operación `aws lightsail peer-vpc`
# (single-shot, idempotente) lo configura. Si se pierde, ejecutar el
# comando manualmente — Terraform no lo gestiona por diseño.
#
# NOTA — Lightsail PgBouncer user_data:
# Las VMs Lightsail se provisionan con bundle Ubuntu base y luego se
# configuran mediante SSH (instalar PgBouncer 1.25.2, Caddy, tmpfiles.d
# para /run/pgbouncer, certs Let's Encrypt). Esa config NO está en
# Terraform — vive en infra/pooler/README.md como playbook manual.
# Si una VM se destruye, re-provisionarla = restaurar desde snapshot
# Lightsail más reciente + verificar tmpfiles.d + verificar pgbouncer.

# ============================================================
# Lightsail instances — 2 VMs en distintas AZ
# ============================================================

resource "aws_lightsail_instance" "pooler_prod_1" {
  name              = "vence-pooler-prod-1"
  availability_zone = "eu-west-2a"
  blueprint_id      = "ubuntu_24_04"
  bundle_id         = "micro_3_0"

  # Created via `aws lightsail create-instances` (2026-05-10, Fase 0 self-hosted
  # pooler). Configuración interna (PgBouncer + Caddy) se aplica via SSH.
  tags = {
    role    = "pooler-ha"
    project = "vence"
  }

  # Lightsail no permite recrear el instance sin perder configuración
  # PgBouncer interna. Si TF detecta drift en blueprint_id/bundle_id (e.g.
  # AWS introduce nueva versión del blueprint Ubuntu), ignorar — recrear
  # requiere playbook manual de configuración.
  lifecycle {
    # add_on: TF no gestiona auto-snapshots de Lightsail (los manuales son
    # suficientes para nuestro caso). Si AWS habilita/deshabilita el
    # auto-snapshot a través de la consola, TF lo ignora.
    ignore_changes = [blueprint_id, bundle_id, user_data, key_pair_name, add_on]
  }
}

resource "aws_lightsail_instance" "pooler_prod_2" {
  name              = "vence-pooler-prod-2"
  availability_zone = "eu-west-2b"
  blueprint_id      = "ubuntu_24_04"
  bundle_id         = "micro_3_0"

  # Created via `aws lightsail create-instances-from-snapshot` (2026-06-01,
  # Fase 6 HA) usando snapshot de pooler-prod-1.
  tags = {
    role    = "pooler-ha"
    project = "vence"
  }

  lifecycle {
    # add_on: TF no gestiona auto-snapshots de Lightsail (los manuales son
    # suficientes para nuestro caso). Si AWS habilita/deshabilita el
    # auto-snapshot a través de la consola, TF lo ignora.
    ignore_changes = [blueprint_id, bundle_id, user_data, key_pair_name, add_on]
  }
}

# ============================================================
# Static IPs — gestionadas FUERA de Terraform
# ============================================================
# El recurso `aws_lightsail_static_ip` del provider AWS de Terraform NO
# soporta `terraform import` (verificado 2026-06-01: error "doesn't
# support import"). Las 2 static IPs ya existen y son estables:
#
#   - vence-pooler-static-ip   → 16.60.146.159  → vence-pooler-prod-1
#   - vence-pooler-static-ip-2 → 18.132.218.219 → vence-pooler-prod-2
#
# Operaciones a mano si hay que recrear:
#   aws lightsail allocate-static-ip --static-ip-name <name>
#   aws lightsail attach-static-ip --static-ip-name <name> --instance-name <vm>
#
# Las private IPs SÍ las gestiona Terraform (data en aws_lightsail_instance).
# Como son las que el NLB target group usa, el "drift" de IPs públicas no
# afecta a la HA.

# ============================================================
# AWS Network Load Balancer — capa de HA delante de las 2 VMs
# ============================================================
# NLB internet-facing en las 3 subnets default (a/b/c) con cross-zone
# enabled para que el tráfico se reparta uniformemente entre las 2 VMs
# Lightsail independientemente de en qué AZ entre el tráfico.
#
# Target type = ip (no instance) porque las VMs Lightsail viven en una
# VPC separada (peered con la default). El NLB con target type IP +
# private IPs de Lightsail + VPC peering funciona.

resource "aws_lb" "pooler" {
  name               = "vence-pooler-nlb"
  internal           = false # internet-facing — el frontend Fargate accede vía
                             # nombre DNS público pooler.vence.es resuelto por
                             # Route53 ALIAS a este NLB. Aunque ambos viven en
                             # AWS, el DNS público + listener TCP es la ruta
                             # de menor latencia con menos config.
  load_balancer_type = "network"
  subnets            = data.aws_subnets.default.ids
  ip_address_type    = "ipv4"

  enable_cross_zone_load_balancing = true

  tags = {
    project    = "vence"
    phase      = "pool-segregation-fase6"
    managed-by = "claude-cli"
  }
}

resource "aws_lb_target_group" "pooler" {
  name        = "vence-pooler-tg"
  port        = 6543
  protocol    = "TCP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id

  health_check {
    enabled             = true
    protocol            = "TCP"
    port                = "6543"
    interval            = 10
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }

  tags = {
    project = "vence"
    phase   = "pool-segregation-fase6"
  }
}

# Registrar las IPs privadas de las VMs Lightsail (accesibles vía VPC peering).
# `availability_zone = "all"` permite registrar IPs de cualquier AZ (Lightsail
# AZs no coinciden con default VPC subnet AZs — son namespaces distintos).
resource "aws_lb_target_group_attachment" "pooler_vm1" {
  target_group_arn  = aws_lb_target_group.pooler.arn
  target_id         = aws_lightsail_instance.pooler_prod_1.private_ip_address
  port              = 6543
  availability_zone = "all"
}

resource "aws_lb_target_group_attachment" "pooler_vm2" {
  target_group_arn  = aws_lb_target_group.pooler.arn
  target_id         = aws_lightsail_instance.pooler_prod_2.private_ip_address
  port              = 6543
  availability_zone = "all"
}

resource "aws_lb_listener" "pooler" {
  load_balancer_arn = aws_lb.pooler.arn
  port              = 6543
  protocol          = "TCP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.pooler.arn
  }
}

# ============================================================
# Outputs útiles (referenciables por route53.tf si se refactoriza)
# ============================================================

output "pooler_nlb_dns_name" {
  description = "DNS name del NLB del pooler — usado como ALIAS en pooler.vence.es"
  value       = aws_lb.pooler.dns_name
}

output "pooler_nlb_zone_id" {
  description = "Hosted zone ID del NLB (constante fija por región)"
  value       = aws_lb.pooler.zone_id
}
