# Self-hosted PgBouncer — Runbook

Pooler PgBouncer corriendo en AWS Lightsail London (eu-west-2a) para aislar
nuestro tráfico del Supavisor regional compartido. Resuelve los blips
documentados 8-10 may 2026.

Roadmap completo: `docs/roadmap/self-hosted-pooler.md`.

## Arquitectura — SCRAM passthrough auth

```
Vercel lambdas (user=postgres, password=<supabase_pg_password>)
    ↓ TLS + SCRAM-SHA-256
PgBouncer 1.25.2 (Lightsail Ubuntu 24.04, $7/mes)
    ↓ TLS + SCRAM passthrough (reusa keys del cliente)
Supabase Postgres 17.4 (db.<ref>.supabase.co:5432)
```

**Por qué passthrough y no plaintext en pgbouncer.ini**: PgBouncer 1.22-1.25
falla al computar el SCRAM proof desde plaintext contra Supabase Postgres 17
(error "Wrong password" aunque el password sea correcto — verificado
matemáticamente). El passthrough mode bypasea esa computación reusando las
keys que el cliente derivó durante su propia autenticación SCRAM. Investigado
2026-05-10, requiere que cliente y upstream usen el mismo usuario.

**Implicación de seguridad**: Vercel debe usar el password real del usuario
`postgres` de Supabase. Es el mismo que ya está en `DATABASE_URL` y
`DATABASE_URL_REPLICA`, así que no se añade superficie de exposición.

## Estado de la instancia

- **IP estática**: `16.60.146.159`
- **DNS**: `pooler.vence.es` (TTL 600s, dondominio.com)
- **Plan**: Lightsail $7/mes, 1 GB RAM, 2 vCPU, 40 GB SSD (90 días gratis)
- **OS**: Ubuntu 24.04 LTS
- **PgBouncer**: 1.25.2 (desde repo oficial PGDG, NO el de Ubuntu 24.04 default que es 1.22)
- **TLS**: Let's Encrypt cert auto-renovado (expira 2026-08-08)
- **SSH key**: `~/.ssh/vence-pooler-key.pem` (no perderla — sin ella la VM es inaccesible)

## Operaciones comunes

### Conectar por SSH
```bash
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es
```

### Test de conexión end-to-end (desde local)
```bash
node -e "
const { Client } = require('pg');
(async () => {
  const c = new Client({
    host: 'pooler.vence.es', port: 6543,
    user: 'postgres', password: '<SUPABASE_PG_PASSWORD>',
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  console.log(await c.query('SELECT version()').then(r => r.rows[0]));
  await c.end();
})()
"
```

### Canary monitoring (`/api/ranking` activo desde 2026-05-10)

```bash
# Ver pools activos en tiempo real (cl_active, sv_active, etc.)
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo -u postgres psql -h /var/run/postgresql -p 6543 -U postgres pgbouncer \
    -c "SHOW POOLS"'

# Stats acumulados desde el último restart (queries servidas, latencias)
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo -u postgres psql -h /var/run/postgresql -p 6543 -U postgres pgbouncer \
    -c "SHOW STATS"'

# Logs de pgbouncer (filtra hits de Vercel — IPs AWS)
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo journalctl -u pgbouncer --since "10 min ago" | grep -E "C-0x|S-0x" | tail -30'

# Hit directo del endpoint canary
curl -sI https://www.vence.es/api/ranking?timeFilter=week&limit=10 | head -5
```

### Rollback rápido del canary

```bash
# Opción 1: bajar el flag en Vercel (NO toca pgbouncer)
# Vercel Dashboard → Settings → Environment Variables → USE_SELF_HOSTED_POOLER → false
# Después: Deployments → Redeploy

# Opción 2: parar pgbouncer mientras se redeploya (opcional, doble seguro)
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo systemctl stop pgbouncer'
```

### Ver estado del pooler
```bash
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo systemctl status pgbouncer --no-pager -l'
```

### Logs en tiempo real
```bash
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo journalctl -u pgbouncer -f'
```

### Estadísticas de pool (SHOW POOLS / SHOW STATS via Unix socket)
```bash
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es '
  sudo -u postgres psql -h /var/run/postgresql -p 6543 -U postgres pgbouncer \
    -c "SHOW POOLS;" -c "SHOW STATS;"
'
```

### Recargar config sin downtime
```bash
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo systemctl reload pgbouncer'
```

### Renovar cert TLS manualmente
```bash
ssh -i ~/.ssh/vence-pooler-key.pem ubuntu@pooler.vence.es \
  'sudo certbot renew --force-renewal'
```

## Variables de Vercel para activar el pooler

Una vez la fase de canary esté verde, en Vercel Settings → Environment Variables:

```
DATABASE_URL_SELF_POOLER=postgresql://postgres:<MISMO_PASSWORD_QUE_DATABASE_URL>@pooler.vence.es:6543/postgres?sslmode=require
USE_SELF_HOSTED_POOLER=true   (toggleable por endpoint en futuras fases)
```

⚠️ **No tocar `DATABASE_URL` ni `DATABASE_URL_REPLICA` aún** — se mantienen como
fallback durante las fases canary.

⚠️ **No usar el password del usuario `vence_app` que se generó inicialmente** —
fue descartado tras descubrir que passthrough requiere mismo usuario en ambos
extremos. La password a usar es la del `postgres` user de Supabase (la misma
que ya está en `DATABASE_URL`).

## Provisión inicial (Fase 0)

### Pre-requisitos manuales (consola AWS + DNS)
1. Lightsail instance con IP estática (✅ hecho: 16.60.146.159)
2. DNS A record `pooler.vence.es` → IP estática (✅ hecho)
3. Firewall Lightsail abriendo 22, 80, 6543 (✅ hecho)

### Pasos automatizados (`provision-pooler.sh`)

1. SSH a la VM y crear `/etc/pgbouncer-vence/secrets.env` con los 4 valores
   (ver header del script)
2. Copiar `provision-pooler.sh` a la VM via `scp`
3. `sudo ./provision-pooler.sh`

El script es idempotente: re-ejecutar es seguro.

## Trampas conocidas

### Auto-ban de IP por Supabase

Tras N intentos fallidos de auth, Supabase bloquea automáticamente la IP
de origen. Visible en Supabase Dashboard → Database → Settings → Network bans
(con botón "Unban IP"). Esto bloquea TODO el tráfico de la VM, incluso psql
directo. Si pgbouncer hace mucho retry con config errónea, la VM queda banned.

**Recomendación**: detener pgbouncer (`sudo systemctl stop pgbouncer`) ANTES
de cambiar config para evitar ban storm. Cambiar config, restart, test ÚNICO,
si falla parar y revisar.

### Plaintext password NO funciona contra Supabase PG17

Documentado arriba. Por eso usamos passthrough auth con SCRAM verifier en
userlist.txt. Si retomamos plaintext en el futuro, será cuando PgBouncer
fixee este bug en una versión posterior a la 1.25.2.

### `db.<ref>.supabase.co` solo resuelve a IPv6

```bash
$ dig +short db.yqbpstxowvgipqspqrgo.supabase.co
2a05:d01c:30c:9d0f:3cb7:1b0:7b0:a6f5
$ dig +short db.yqbpstxowvgipqspqrgo.supabase.co A
(empty)
```

Lightsail dual-stack maneja esto correctamente. Si en futuro Supabase migrara
a IPv4-only o cambiara el endpoint, habría que verificar conectividad.

## Rollback rápido

### Si pgbouncer rompe pero la VM sigue viva
```bash
ssh ... 'sudo systemctl stop pgbouncer'
# En Vercel: bajar USE_SELF_HOSTED_POOLER=false → tráfico vuelve al Shared Pooler en <3 min
```

### Si la VM entera se cae
1. En Vercel: `USE_SELF_HOSTED_POOLER=false` (rollback instantáneo)
2. Recuperar VM:
   - Restaurar desde snapshot diario en Lightsail (1-click)
   - O recrear: ejecutar `provision-pooler.sh` en VM nueva
3. Verificar pooler responde antes de volver a poner `USE_SELF_HOSTED_POOLER=true`

## Costes recurrentes

- Lightsail $7/mes (gratis primeros 90 días)
- Snapshots automáticos ~$0.50/mes
- IP estática $0 (gratis mientras attached)
- Total esperado: **$7-8/mes a partir del día 91**

Con los $200 USD de créditos de la cuenta nueva: ~24 meses de runway.

## Referencias

- Roadmap: `docs/roadmap/self-hosted-pooler.md`
- Arquitectura general: `docs/ARCHITECTURE_ROADMAP.md` Fase 3
- Procedimiento blips: `docs/procedures/revisar-errores-fallos.md`
- Investigación de PgBouncer SCRAM bug 2026-05-10: ver historial de commits del día
