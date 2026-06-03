# ============================================================
# Observabilidad del BORDE — Gap 14 (AWS) del manual de observabilidad
# ============================================================
#
# Cierra el punto ciego que destapó el incidente del email de una impugnación
# (03/06/2026): CloudFront/ALB cortaron por timeout (502→504) en
# /api/v2/dispute/resolve, pero el handler Fargate siguió corriendo y registró
# 200 → `observable_events` quedó a 0. La app NUNCA se entera de los 504 que
# sufre el usuario.
#
# Estas alarmas observan la capa que SÍ ve el corte (el ALB), no el handler.
# Reglas accionables (principio nº4 del manual): umbrales de arranque, afinar
# con datos reales.
#
# Canal SNS: reutiliza el topic ya confirmado `canary_alerts` (mismo región) →
# cero pasos manuales, alertas operativas desde el `apply`.
#
# NOTA — CloudFront (us-east-1): se omiten a propósito las alarmas de
# `5xxErrorRate`/`OriginLatency` de CloudFront porque sus métricas viven en
# us-east-1 y una alarma solo puede notificar a un SNS de SU región; no hay
# topic confirmado en us-east-1 y crear uno exige confirmar una suscripción de
# email (paso manual con acceso a la bandeja de admin). Las 4 alarmas de ALB de
# abajo ya capturan el 502/504 en el ORIGEN (que es donde nace el incidente).
# Si en el futuro se quiere la capa CDN, añadir topic us-east-1 + confirmación.
# ============================================================

# (1) 5xx generados por el PROPIO ALB: 502/503/504. Es exactamente el "gateway
#     cortó" que sufrimos. Su aparición = usuarios viendo errores que el handler
#     no registra. CRÍTICA.
resource "aws_cloudwatch_metric_alarm" "alb_elb_5xx" {
  alarm_name          = "vence-alb-elb-5xx"
  alarm_description   = "El ALB devuelve 5xx propios (502/503/504): gateway/origen caído o timeouteando. Es el patrón del incidente de impugnación 03/06."
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
