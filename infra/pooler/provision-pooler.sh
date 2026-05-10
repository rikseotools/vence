#!/usr/bin/env bash
# infra/pooler/provision-pooler.sh
#
# Provisión idempotente de un pooler PgBouncer self-hosted en una instancia
# Ubuntu 24.04 LTS de AWS Lightsail (London, eu-west-2).
#
# Arquitectura: SCRAM-SHA-256 PASSTHROUGH AUTH
# - Cliente y upstream usan el mismo usuario `postgres` con la misma password
# - PgBouncer reutiliza las SCRAM keys del cliente para autenticar a Supabase
# - NO se almacena la password en plaintext en pgbouncer.ini
# - El SCRAM verifier (storedKey/serverKey) viene de Supabase pg_authid
#
# Por qué passthrough y no plaintext: PgBouncer 1.22-1.25 falla al computar
# el SCRAM proof desde plaintext contra Supabase Postgres 17 ("Wrong password"
# aunque el password sea correcto — verificado matemáticamente). Passthrough
# bypasea esa computación reusando las keys del cliente.
#
# Pre-requisitos (manuales antes de correr este script):
#   1. Instancia Lightsail Ubuntu 24.04 con IP estática
#   2. DNS A record apuntando al dominio (pooler.vence.es por defecto)
#   3. Firewall Lightsail abriendo puertos 22, 80, 6543
#   4. Fichero /etc/pgbouncer-vence/secrets.env existe con:
#        SUPABASE_PG_PASSWORD=<password de postgres role en Supabase>
#        SUPABASE_HOST=db.<project-ref>.supabase.co
#        DOMAIN=pooler.vence.es
#        ADMIN_EMAIL=<email para Let's Encrypt>
#
# Uso:
#   sudo ./provision-pooler.sh
#
# El script es idempotente: re-ejecutar es seguro.

set -euo pipefail

# ==============================================================================
# Helpers
# ==============================================================================

log()  { echo -e "\033[1;34m[$(date +%H:%M:%S)]\033[0m $*"; }
ok()   { echo -e "\033[1;32m  ✓\033[0m $*"; }
warn() { echo -e "\033[1;33m  ⚠\033[0m $*"; }
err()  { echo -e "\033[1;31m  ✗\033[0m $*" >&2; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Este script debe ejecutarse con sudo"
    exit 1
  fi
}

SECRETS_FILE="/etc/pgbouncer-vence/secrets.env"

require_secrets() {
  if [[ ! -f $SECRETS_FILE ]]; then
    err "Falta $SECRETS_FILE"
    err "Crea el fichero con (uso sudo):"
    err "  SUPABASE_PG_PASSWORD=..."
    err "  SUPABASE_HOST=db.<ref>.supabase.co"
    err "  DOMAIN=pooler.vence.es"
    err "  ADMIN_EMAIL=tu-email@dominio"
    exit 1
  fi
  # shellcheck disable=SC1090
  source "$SECRETS_FILE"
  : "${SUPABASE_PG_PASSWORD:?missing in secrets.env}"
  : "${SUPABASE_HOST:?missing in secrets.env}"
  : "${DOMAIN:?missing in secrets.env}"
  : "${ADMIN_EMAIL:?missing in secrets.env}"
}

# ==============================================================================
# 1. Sistema base + repo PGDG (PgBouncer 1.25+)
# ==============================================================================

step_system_base() {
  log "Paso 1/7: Sistema base + repo PGDG"
  export DEBIAN_FRONTEND=noninteractive

  # PGDG repo para PgBouncer reciente (1.25+) — el de Ubuntu 24.04 default es 1.22
  if [[ ! -f /etc/apt/keyrings/pgdg.gpg ]]; then
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | gpg --dearmor -o /etc/apt/keyrings/pgdg.gpg
    echo "deb [signed-by=/etc/apt/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list
    ok "Repo PGDG añadido"
  fi

  apt-get update -qq
  apt-get install -yqq \
    pgbouncer \
    certbot \
    python3-certbot \
    ufw \
    fail2ban \
    unattended-upgrades \
    netcat-openbsd \
    postgresql-client-common \
    postgresql-client-16
  ok "Paquetes instalados (pgbouncer $(pgbouncer --version | head -1 | awk '{print $2}'))"

  # Auto-updates de seguridad
  cat >/etc/apt/apt.conf.d/52unattended-upgrades-vence <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
};
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
  systemctl enable --now unattended-upgrades.service >/dev/null 2>&1 || true
  ok "Auto-updates de seguridad activados"
}

# ==============================================================================
# 2. Firewall (UFW como segunda capa, además del firewall Lightsail)
# ==============================================================================

step_firewall() {
  log "Paso 2/7: Firewall (UFW)"
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow 22/tcp comment 'SSH' >/dev/null
  ufw allow 80/tcp comment 'HTTP for certbot' >/dev/null
  ufw allow 6543/tcp comment 'PgBouncer' >/dev/null
  ufw --force enable >/dev/null
  ok "UFW activo: SSH(22), HTTP(80), PgBouncer(6543)"
}

# ==============================================================================
# 3. TLS — Let's Encrypt via certbot (HTTP-01 challenge)
# ==============================================================================

step_tls() {
  log "Paso 3/7: Certificado TLS"
  local cert_dir="/etc/letsencrypt/live/$DOMAIN"

  if [[ -f $cert_dir/fullchain.pem ]]; then
    ok "Cert existente encontrado, skip emisión"
  else
    if ! certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "$ADMIN_EMAIL" \
      --domain "$DOMAIN" \
      --no-eff-email; then
      err "certbot falló — verifica que DNS resuelve $DOMAIN al IP correcto y puerto 80 está abierto"
      exit 1
    fi
    ok "Cert emitido para $DOMAIN"
  fi

  # Hook de deploy: copiar cert renovado a directorio que pgbouncer puede leer
  local hook_script="/etc/letsencrypt/renewal-hooks/deploy/copy-to-pgbouncer.sh"
  install -d -m 0755 "$(dirname "$hook_script")"
  cat >"$hook_script" <<EOF
#!/usr/bin/env bash
set -euo pipefail
DOMAIN_DIR="\${RENEWED_LINEAGE:-/etc/letsencrypt/live/$DOMAIN}"
DEST="/etc/pgbouncer-vence/tls"
mkdir -p "\$DEST"
install -m 0644 -o postgres -g postgres "\$DOMAIN_DIR/fullchain.pem" "\$DEST/fullchain.pem"
install -m 0600 -o postgres -g postgres "\$DOMAIN_DIR/privkey.pem"   "\$DEST/privkey.pem"
systemctl reload pgbouncer 2>/dev/null || true
EOF
  chmod +x "$hook_script"

  install -d -m 0755 -o postgres -g postgres /etc/pgbouncer-vence/tls
  RENEWED_LINEAGE="$cert_dir" "$hook_script"
  ok "Cert copiado a /etc/pgbouncer-vence/tls/ con perms postgres:postgres"

  systemctl enable --now certbot.timer >/dev/null 2>&1 || true
  ok "Timer de renovación certbot activo"
}

# ==============================================================================
# 4. Obtener SCRAM verifier de Supabase (passthrough setup)
# ==============================================================================

step_pgbouncer_config() {
  log "Paso 4/7: Configuración PgBouncer (passthrough auth)"

  # Directorios
  install -d -m 0755 /etc/pgbouncer-vence
  install -d -m 0750 -o postgres -g postgres /var/log/pgbouncer
  install -d -m 0750 -o postgres -g postgres /var/run/pgbouncer

  # Obtener el SCRAM verifier del usuario postgres desde Supabase pg_authid.
  # Esto requiere conexión directa válida al puerto 5432.
  local scram_hash
  scram_hash="$(PGPASSWORD="$SUPABASE_PG_PASSWORD" psql \
    "host=$SUPABASE_HOST port=5432 user=postgres dbname=postgres sslmode=require" \
    -t -A -c "SELECT rolpassword FROM pg_authid WHERE rolname = 'postgres'" 2>&1 | tail -1)"

  if [[ "$scram_hash" != SCRAM-SHA-256* ]]; then
    err "No se pudo obtener el SCRAM hash desde Supabase"
    err "Output: $scram_hash"
    err "Verifica que SUPABASE_PG_PASSWORD es correcto y que la IP no está baneada."
    exit 1
  fi
  ok "SCRAM verifier obtenido de pg_authid"

  # userlist.txt: solo postgres con su SCRAM verifier (passthrough auth)
  cat >/etc/pgbouncer-vence/userlist.txt <<EOF
"postgres" "$scram_hash"
EOF
  chown postgres:postgres /etc/pgbouncer-vence/userlist.txt
  chmod 0640 /etc/pgbouncer-vence/userlist.txt
  ok "userlist.txt generado con SCRAM verifier de Supabase"

  # pgbouncer.ini — sin password en [databases], passthrough vía userlist.txt
  cat >/etc/pgbouncer-vence/pgbouncer.ini <<EOF
;; pgbouncer.ini — vence pooler (PASSTHROUGH AUTH)
;; Generado por provision-pooler.sh — NO editar a mano

[databases]
;; SIN password= aquí. PgBouncer leerá el SCRAM verifier de userlist.txt
;; y reutilizará las keys del cliente (passthrough) para autenticar upstream.
postgres = host=$SUPABASE_HOST port=5432 dbname=postgres

[pgbouncer]
listen_addr = *
listen_port = 6543

;; Auth: clients SCRAM-SHA-256 contra userlist.txt
auth_type = scram-sha-256
auth_file = /etc/pgbouncer-vence/userlist.txt

;; Pool tuneado para Vercel pico ~500 lambdas con margen
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 30
reserve_pool_size = 5
reserve_pool_timeout = 3
max_db_connections = 60
server_idle_timeout = 600
server_lifetime = 3600

;; CRÍTICO: postgres-js (Drizzle) envía estos parámetros como startup options.
;; PgBouncer los rechaza por default (cierra conexión con
;; "unsupported startup parameter in options: statement_timeout"). Sin esto,
;; CUALQUIER lambda que use db/client.ts da 500. Los timeouts ya están
;; configurados internamente vía la connection string al upstream y el
;; statement_timeout de Postgres, así que es seguro ignorarlos aquí.
ignore_startup_parameters = extra_float_digits,statement_timeout,idle_in_transaction_session_timeout,search_path,application_name

;; TLS — clientes deben usar sslmode=require o superior
client_tls_sslmode = require
client_tls_cert_file = /etc/pgbouncer-vence/tls/fullchain.pem
client_tls_key_file = /etc/pgbouncer-vence/tls/privkey.pem

;; TLS — conexión saliente a Supabase (require, no verify-full porque cert custom)
server_tls_sslmode = require

;; Logging
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /var/run/pgbouncer/pgbouncer.pid
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60

;; Admin (vía socket Unix solo, no TCP)
unix_socket_dir = /var/run/postgresql
admin_users = postgres
stats_users = postgres
EOF
  chown postgres:postgres /etc/pgbouncer-vence/pgbouncer.ini
  chmod 0640 /etc/pgbouncer-vence/pgbouncer.ini
  ok "pgbouncer.ini generado (passthrough auth, SIN plaintext password)"

  # Override del systemd default para usar nuestro config
  install -d -m 0755 /etc/systemd/system/pgbouncer.service.d
  cat >/etc/systemd/system/pgbouncer.service.d/override.conf <<'EOF'
[Service]
ExecStart=
ExecStart=/usr/sbin/pgbouncer /etc/pgbouncer-vence/pgbouncer.ini
ExecReload=
ExecReload=/bin/kill -HUP $MAINPID
EOF
  systemctl daemon-reload
  ok "Systemd override aplicado"
}

# ==============================================================================
# 5. Arrancar pgbouncer
# ==============================================================================

step_start_pgbouncer() {
  log "Paso 5/7: Arrancar pgbouncer"
  systemctl enable pgbouncer >/dev/null
  systemctl restart pgbouncer
  sleep 2
  if systemctl is-active --quiet pgbouncer; then
    ok "pgbouncer activo"
  else
    err "pgbouncer NO arrancó. Logs:"
    journalctl -u pgbouncer -n 30 --no-pager >&2
    exit 1
  fi
}

# ==============================================================================
# 6. Smoke test desde la propia VM
# ==============================================================================

step_smoke_test() {
  log "Paso 6/7: Smoke test (passthrough auth)"

  # 1) Puerto local responde
  if ! timeout 5 bash -c "</dev/tcp/127.0.0.1/6543"; then
    err "Puerto 6543 no responde localmente"
    exit 1
  fi
  ok "Puerto 6543 escuchando localmente"

  # 2) Conexión completa: cliente postgres + password Supabase via passthrough
  if PGPASSWORD="$SUPABASE_PG_PASSWORD" psql \
       "host=$DOMAIN port=6543 user=postgres dbname=postgres sslmode=require" \
       -c "SELECT 1 AS ok;" 2>&1 | grep -q "1"; then
    ok "Conexión vía $DOMAIN:6543 funciona (passthrough SCRAM + TLS + query)"
  else
    err "Smoke test falló — revisa logs de pgbouncer"
    PGPASSWORD="$SUPABASE_PG_PASSWORD" psql \
       "host=$DOMAIN port=6543 user=postgres dbname=postgres sslmode=require" \
       -c "SELECT 1 AS ok;" 2>&1 | tail -10 >&2
    exit 1
  fi
}

# ==============================================================================
# 7. Resumen final
# ==============================================================================

step_summary() {
  log "Paso 7/7: Resumen"
  cat <<EOF

╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║  PgBouncer self-hosted DESPLEGADO (passthrough auth)             ║
║                                                                  ║
╠══════════════════════════════════════════════════════════════════╣
║  Endpoint: $DOMAIN:6543
║  Auth:     SCRAM-SHA-256 passthrough (cliente=upstream=postgres)
║  User:     postgres
║  Password: <SUPABASE_PG_PASSWORD — la misma que en DATABASE_URL>
║                                                                  ║
║  Cliente DSN para Vercel:                                        ║
║    postgresql://postgres:<password>@$DOMAIN:6543/postgres?sslmode=require
║                                                                  ║
║  Comandos útiles:                                                ║
║    sudo systemctl status pgbouncer                               ║
║    sudo journalctl -u pgbouncer -f                               ║
║    sudo systemctl reload pgbouncer  # tras cambiar config        ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
}

# ==============================================================================
# Main
# ==============================================================================

main() {
  require_root
  require_secrets
  step_system_base
  step_firewall
  step_tls
  step_pgbouncer_config
  step_start_pgbouncer
  step_smoke_test
  step_summary
}

main "$@"
