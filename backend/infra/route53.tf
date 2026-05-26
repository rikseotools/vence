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
# Mantenido tal cual (incluye legacy Zoho que NO se usa pero no hace daño).
# Limpieza pendiente: sesión aparte tras confirmar Route 53 estable.
resource "aws_route53_record" "apex_txt" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "vence.es"
  type    = "TXT"
  ttl     = 300
  records = [
    "v=spf1 include:zohomail.eu include:amazonses.com ~all",
    "google-site-verification=LSUX7g3QportpivZYokN6Kw2lZ4eODXlqmLocRAmEuE",
  ]
}

# MX — AWS SES (eu-west-1) recibe email entrante. Replicado tal cual.
# AUDIT 2026-05-26: SES no tiene rule set activo ni identidad verificada,
# por lo que emails entrantes se pierden. Limpieza pendiente fase aparte.
resource "aws_route53_record" "apex_mx" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "vence.es"
  type    = "MX"
  ttl     = 300
  records = ["20 inbound-smtp.eu-west-1.amazonaws.com."]
}

# ============================================================
# WWW (www.vence.es)
#
# AHORA: 100% Vercel (CNAME al deploy de Vercel — apex de Vercel da
# 216.150.16.1 + 216.150.1.1 que son IPs estables de Vercel).
#
# TRAS PROPAGACIÓN: descomentar el bloque WEIGHTED CANARY más abajo y
# COMENTAR este resource. Ahí weighted (10% AWS, 90% Vercel).
# ============================================================

resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.vence.zone_id
  name    = "www.vence.es"
  type    = "CNAME"
  ttl     = 300
  records = ["f1254f308aeab97a.vercel-dns-017.com."]
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
