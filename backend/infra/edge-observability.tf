# ============================================================
# Observabilidad del BORDE — Gap 14 (AWS) del manual de observabilidad
# ============================================================
#
# Cierra el punto ciego que destapó el incidente del email de Eva (03/06/2026):
# CloudFront/ALB cortaron por timeout (502→504) en /api/v2/dispute/resolve, pero
# el handler Fargate siguió corriendo y registró 200 → `observable_events` quedó
# a 0. La app NUNCA se entera de los 504 que sufre el usuario.
#
# Estas alarmas observan la capa que SÍ ve el corte (CloudFront + ALB), no el
# handler. Reglas accionables (principio nº4 del manual): umbrales de arranque,
# afinar con datos reales.
#
# Canales SNS:
#   - ALB (región por defecto)  → reusa el topic ya confirmado `canary_alerts`.
#   - CloudFront (us-east-1)     → topic nuevo `edge_alerts_use1` (las métricas
#                                  AWS/CloudFront solo existen en us-east-1, y una
#                                  alarma solo puede notificar a un SNS de SU región).
#
# ⚠️ Tras `terraform apply`: confirmar la nueva suscripción de email (us-east-1)
#    desde la bandeja de var.admin_email (un clic en el enlace de AWS SNS).
# ============================================================

# ------------------------------------------------------------
# Habilitar métricas adicionales de CloudFront (OriginLatency, error-rate por
# código). Coste ~$0.01/métrica/mes/distribución — despreciable, necesario para
# medir latencia de origen p99.
# ------------------------------------------------------------
resource "aws_cloudfront_monitoring_subscription" "frontend" {
  provider        = aws.us_east_1
  distribution_id = aws_cloudfront_distribution.frontend.id

  monitoring_subscription {
    realtime_metrics_subscription_config {
      realtime_metrics_subscription_status = "Enabled"
    }
  }
}

# ============================================================
# SNS us-east-1 para las alarmas de CloudFront
# ============================================================
resource "aws_sns_topic" "edge_alerts_use1" {
  provider = aws.us_east_1
  name     = "vence-edge-alerts-use1"
  tags     = { Project = "vence" }
}

resource "aws_sns_topic_subscription" "edge_alerts_use1_email" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.edge_alerts_use1.arn
  protocol  = "email"
  endpoint  = var.admin_email
}

# ============================================================
# ALARMAS ALB (región por defecto) — la señal más directa del incidente
# El ALB es compartido (frontend + API). Las ELB-5xx son a nivel LB; las de
# target/latencia se filtran al target group del frontend.
# ============================================================

# (1) 5xx generados por el PROPIO ALB: 502/503/504. Es exactamente el "gateway
#     cortó" que sufrimos. Su aparición = usuarios viendo errores que el handler
#     no registra. CRÍTICA.
resource "aws_cloudwatch_metric_alarm" "alb_elb_5xx" {
  alarm_name          = "vence-alb-elb-5xx"
  alarm_description   = "El ALB devuelve 5xx propios (502/503/504): gateway/origen caído o timeouteando. Incluye el patrón del incidente Eva 03/06."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = data.aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.canary_alerts.arn]
  ok_actions    = [aws_sns_topic.canary_alerts.arn]
  tags          = { Project = "vence" }
}

# (2) 5xx que SÍ produce el target (la app Fargate) y llegan al ALB. Captura
#     crashes del servidor OpenNext que mueren antes de `withErrorLogging`.
resource "aws_cloudwatch_metric_alarm" "alb_frontend_target_5xx" {
  alarm_name          = "vence-frontend-target-5xx"
  alarm_description   = "El target del frontend (Fargate OpenNext) devuelve 5xx. Cubre crashes que no llegan a withErrorLogging."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_Target_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = data.aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.frontend.arn_suffix
  }

  alarm_actions = [aws_sns_topic.canary_alerts.arn]
  ok_actions    = [aws_sns_topic.canary_alerts.arn]
  tags          = { Project = "vence" }
}

# (3) Latencia p99 del target del frontend. Avisa ANTES de que la lentitud se
#     convierta en 504 (en el incidente el endpoint tardaba >45s).
resource "aws_cloudwatch_metric_alarm" "alb_frontend_p99_latency" {
  alarm_name          = "vence-frontend-target-p99-latency"
  alarm_description   = "Latencia p99 del frontend Fargate alta (>5s sostenido 10min). Antesala de los 504."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p99"
  period              = 300
  evaluation_periods  = 2
  threshold           = 5 # segundos
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = data.aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.frontend.arn_suffix
  }

  alarm_actions = [aws_sns_topic.canary_alerts.arn]
  ok_actions    = [aws_sns_topic.canary_alerts.arn]
  tags          = { Project = "vence" }
}

# (4) Hosts no sanos en el target group del frontend (health check fallando =
#     tasks cayéndose / circuit breaker). CRÍTICA.
resource "aws_cloudwatch_metric_alarm" "alb_frontend_unhealthy_hosts" {
  alarm_name          = "vence-frontend-unhealthy-hosts"
  alarm_description   = "Hay tasks del frontend fallando el health check (/api/health/db-ready)."
  namespace           = "AWS/ApplicationELB"
  metric_name         = "UnHealthyHostCount"
  statistic           = "Maximum"
  period              = 60
  evaluation_periods  = 3
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = data.aws_lb.main.arn_suffix
    TargetGroup  = aws_lb_target_group.frontend.arn_suffix
  }

  alarm_actions = [aws_sns_topic.canary_alerts.arn]
  ok_actions    = [aws_sns_topic.canary_alerts.arn]
  tags          = { Project = "vence" }
}

# ============================================================
# ALARMAS CLOUDFRONT (us-east-1) — top del funnel, lo que ve el navegador
# ============================================================

# (5) Tasa de 5xx servida por CloudFront al usuario (incluye errores de origen
#     inalcanzable que ni llegan al ALB). CRÍTICA.
resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx_rate" {
  provider            = aws.us_east_1
  alarm_name          = "vence-cloudfront-5xx-rate"
  alarm_description   = "CloudFront sirve >2% de 5xx al usuario (origen caído/timeouteando o errores del propio CDN)."
  namespace           = "AWS/CloudFront"
  metric_name         = "5xxErrorRate"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 2 # porcentaje
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend.id
    Region         = "Global"
  }

  alarm_actions = [aws_sns_topic.edge_alerts_use1.arn]
  ok_actions    = [aws_sns_topic.edge_alerts_use1.arn]
  tags          = { Project = "vence" }
}

# (6) Latencia de origen p99 vista por CloudFront (requiere monitoring
#     subscription de arriba).
resource "aws_cloudwatch_metric_alarm" "cloudfront_origin_latency_p99" {
  provider            = aws.us_east_1
  alarm_name          = "vence-cloudfront-origin-latency-p99"
  alarm_description   = "Latencia de origen p99 vista por CloudFront alta (>5s sostenido)."
  namespace           = "AWS/CloudFront"
  metric_name         = "OriginLatency"
  extended_statistic  = "p99"
  period              = 300
  evaluation_periods  = 2
  threshold           = 5000 # milisegundos
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.frontend.id
    Region         = "Global"
  }

  alarm_actions = [aws_sns_topic.edge_alerts_use1.arn]
  ok_actions    = [aws_sns_topic.edge_alerts_use1.arn]

  depends_on = [aws_cloudfront_monitoring_subscription.frontend]
  tags       = { Project = "vence" }
}

# ============================================================
# Outputs
# ============================================================
output "edge_alerts_use1_topic_arn" {
  value = aws_sns_topic.edge_alerts_use1.arn
}
