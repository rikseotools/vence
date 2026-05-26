# ============================================================
# Route 53 — Bloque 5 Fase E.4.3 (2026-05-26)
#
# Migración del DNS de vence.es desde DonDominio a Route 53.
# Replica TODOS los records actuales tal cual (cero limpieza simultánea —
# no mezclar migración con limpieza, garantiza rollback trivial).
#
# Tras el `terraform apply`:
#   1. Anotar los 4 nameservers del hosted zone (output `route53_nameservers`).
#   2. Cambiar en DonDominio → "Mis dominios" → vence.es → Servidores DNS:
#        ns-XXX.awsdns-YY.com / .net / .org / .co.uk
#   3. Esperar propagación (24-48h, mayoría <6h).
#   4. Validar con `dig NS vence.es @1.1.1.1` que devuelve los AWS NS.
#   5. Una vez propagado: habilitar weighted record www.vence.es (10% AWS,
#      90% Vercel) en este mismo archivo, sección "WEIGHTED CANARY" abajo.
# ============================================================

resource "aws_route53_zone" "vence" {
  name    = "vence.es"
  comment = "Migrado desde DonDominio 2026-05-26 — Bloque 5 Fase E.4.3"

  tags = {
    Project   = "vence"
    ManagedBy = "terraform"
  }
}

# ============================================================
# APEX (vence.es)
# ============================================================

# Apex A — Vercel actualmente. Cuando cutover (E.6) cambiar a Alias de CloudFront.
resource "aws_route53_record" "apex_a" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "vence.es"
  type    = "A"
  ttl     = 300
  records = ["216.198.79.1"]
}

# Apex TXT — SPF + Google Search Console verification.
#
# AUDIT 2026-05-26: el SPF original era
#   "v=spf1 include:zohomail.eu include:amazonses.com ~all"
# Pero:
#   - Zoho: 0 referencias en código de Vence. Confirmado legacy abandonado.
#   - amazonses: SES no tiene identidad vence.es verificada ni rule set
#     activo (audit 2026-05-26). Pero Resend (que es lo que SÍ se usa para
#     enviar email) puede internamente usar SES como infraestructura, así
#     que conservamos amazonses para no romper deliverability accidentalmente.
# Cambio aplicado: quitar Zoho, mantener amazonses (defensive).
resource "aws_route53_record" "apex_txt" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "vence.es"
  type    = "TXT"
  ttl     = 300
  records = [
    "v=spf1 include:amazonses.com ~all",
    "google-site-verification=LSUX7g3QportpivZYokN6Kw2lZ4eODXlqmLocRAmEuE",
  ]
}

# MX — ELIMINADO 2026-05-26.
#
# Audit confirmó que el MX 20 inbound-smtp.eu-west-1.amazonaws.com era
# basura: SES no tenía rule sets activos ni identidad verificada. Emails
# enviados a info@vence.es y similares CAÍAN EN SILENCIO (rebote interno
# Amazon sin notificación al emisor).
#
# Decisión: borrar el MX. Sin MX, los emails entrantes generan NXDOMAIN/
# rebote LIMPIO al emisor — el emisor SE ENTERA de que no se entregó. Mucho
# mejor que el agujero negro silencioso anterior.
#
# Si en el futuro Vence necesita recibir email en @vence.es, configurar
# Resend Inbound (incluido en plan free) o AWS SES con rule sets activos.

# ============================================================
# WWW (www.vence.es) — CUTOVER E.6 (2026-05-26)
#
# Cambio de Vercel a CloudFront. Cert wildcard ACM us-east-1 cubre
# www + apex + preview-aws. CloudFront acepta los 3 como aliases.
# ALB listener tiene cert wildcard eu-west-2 para SNI handshake con
# Host=www.vence.es.
#
# TTL=60s para react rápido si hay que rollback (cambiar valor del
# CNAME de nuevo a vercel-dns-017.com y propagación en ~60s).
#
# Pre-cutover snapshot: f1254f308aeab97a.vercel-dns-017.com.
# ============================================================

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "www.vence.es"
  type    = "CNAME"
  ttl     = 60
  records = ["d25xcm3wrnxoty.cloudfront.net."]
}

# ============================================================
# SUBDOMINIOS (auth, api, preview-aws + ACM validation)
# ============================================================

# auth.vence.es → Supabase auth.
resource "aws_route53_record" "auth" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "auth.vence.es"
  type    = "CNAME"
  ttl     = 300
  records = ["yqbpstxowvgipqspqrgo.supabase.co."]
}

# api.vence.es → ALB backend (vence-backend-alb).
# TODO: cambiar a alias del ALB en Terraform-native (mejor que CNAME).
# Por ahora CNAME para replicar idéntico estado actual.
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "api.vence.es"
  type    = "CNAME"
  ttl     = 300
  records = ["vence-backend-alb-300489916.eu-west-2.elb.amazonaws.com."]
}

# preview-aws.vence.es → CloudFront distribution del frontend.
resource "aws_route53_record" "preview_aws" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "preview-aws.vence.es"
  type    = "CNAME"
  ttl     = 300
  records = ["d25xcm3wrnxoty.cloudfront.net."]
}

# ACM validation CNAME — necesario para que el cert de preview-aws.vence.es
# siga renovándose automáticamente. Si lo borramos, ACM lo recreará bajo
# demanda pero genera 60s de downtime del cert. Mejor mantener.
resource "aws_route53_record" "acm_preview_validation" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "_cf82c1f2bdc4eb9aba9ade1ca43940bd.preview-aws.vence.es"
  type    = "CNAME"
  ttl     = 300
  records = ["_0846183dac1109541bb8c4b780579982.jkddzztszm.acm-validations.aws."]
}

# ACM validation wildcard *.vence.es + vence.es (Bloque 5 Fase E.6 cutover).
#
# Esquiva el problema CAA de Vercel: el apex vence.es NO tiene CAA records
# (los CAA viven en el target del CNAME Vercel — pero el apex es A directo).
# Por tanto ACM puede validar contra el apex sin bloqueo. El wildcard
# *.vence.es se valida con el MISMO record (AWS reusa cuando el target es
# el mismo dominio).
#
# Una vez ISSUED, este cert se asigna a CloudFront para que sirva
# www.vence.es como alias. Después cambiamos el CNAME www → CloudFront.
resource "aws_route53_record" "acm_wildcard_validation" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "_6286d57c2b634bfee7cb9dacdaad70e6.vence.es"
  type    = "CNAME"
  ttl     = 300
  records = ["_dedf6b6112300102c7fe133119a2693a.jkddzztszm.acm-validations.aws."]
}

# ============================================================
# INFRA INTERNA (self-hosted PgBouncer)
# ============================================================

# pooler.vence.es → AWS Lightsail London (eu-west-2a), IP estática 16.60.146.159.
#
# Self-hosted PgBouncer 1.25.2 que aísla nuestro tráfico del Supavisor regional
# compartido de Supabase. Provisión y arquitectura completas en
# infra/pooler/README.md y docs/roadmap/self-hosted-pooler.md.
#
# AUDIT 2026-05-26: este record se quedó FUERA de la migración inicial
# DonDominio → Route 53 (Bloque 5 Fase E.4.3, commit dd63e0e9). Al cambiar
# los NS a AWS, `pooler.vence.es` dejó de resolver → el build de Vercel
# rompió porque DATABASE_URL apunta aquí. Restaurado en sesión 26/05.
#
# Regla para evitar regresiones: TODO subdominio activo en producción
# (Vercel build env, backend, observabilidad...) DEBE estar en este archivo.
resource "aws_route53_record" "pooler" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "pooler.vence.es"
  type    = "A"
  ttl     = 300
  records = ["16.60.146.159"]
}

# ============================================================
# EMAIL (DMARC + Resend DKIM)
# ============================================================

resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "_dmarc.vence.es"
  type    = "TXT"
  ttl     = 300
  records = ["v=DMARC1; p=none; rua=mailto:info@vence.es"]
}

resource "aws_route53_record" "resend_dkim" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "resend._domainkey.vence.es"
  type    = "TXT"
  ttl     = 300
  records = [
    "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDlNHMGAZ2clokzgynlwsVQMrhlJ+1Iqt/pY8371DByyS0/OQ8pFIMBzOfa4e3YM661zfWQ2+MbB/qrNdsaux1DUxAFQUFcyyYZfCNz65My+M3CG6KSNgnJPEhkMrUisrIZ7OlXk/AeKswBb8vqfcgRfDw8L7TeAkoGweByYdO/qQIDAQAB",
  ]
}

# ============================================================
# WEIGHTED CANARY (descomentar tras propagación NS — sesión siguiente)
# ============================================================
#
# Reemplaza el `aws_route53_record.www` simple de arriba por dos records
# weighted: 10% del tráfico a AWS CloudFront, 90% a Vercel. Subir
# gradualmente a 50/50 → 100/0 en sesiones siguientes monitoreando SLOs.
#
# resource "aws_route53_record" "www_canary_vercel" {
#   zone_id        = aws_route53_zone.vence.zone_id
#   name           = "www.vence.es"
#   type           = "CNAME"
#   ttl            = 60   # bajo durante canary para react rápido al ajustar
#   set_identifier = "vercel"
#   weighted_routing_policy { weight = 90 }
#   records        = ["f1254f308aeab97a.vercel-dns-017.com."]
# }
#
# resource "aws_route53_record" "www_canary_aws" {
#   zone_id        = aws_route53_zone.vence.zone_id
#   name           = "www.vence.es"
#   type           = "CNAME"
#   ttl            = 60
#   set_identifier = "aws"
#   weighted_routing_policy { weight = 10 }
#   records        = ["d25xcm3wrnxoty.cloudfront.net."]
# }

# ============================================================
# OUTPUTS — los 4 nameservers para poner en DonDominio
# ============================================================

output "route53_nameservers" {
  description = "4 NS Route 53. Pegar en DonDominio → Mis dominios → vence.es → Servidores DNS."
  value       = aws_route53_zone.vence.name_servers
}

output "route53_zone_id" {
  value = aws_route53_zone.vence.zone_id
}
