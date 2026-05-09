# Roadmap — Self-hosted Pooler

> **Implementación elegida (mayo 2026)**: PgBouncer en AWS Lightsail London. Alternativas evaluadas (PgCat, Supabase Dedicated Pooler, Coolify) en sección "Comparación de opciones".

> **Estado**: ⏳ Pendiente arranque (Fase 0)
> **Propietario**: equipo Vence
> **Coste recurrente esperado**: ~$10/mes (Lightsail $10) → opcional escalar a HA $50/mes
> **Última actualización**: 2026-05-09

---

## Contexto y motivación

### Por qué este roadmap

El cascade del 8 may 23:27 UTC (3 minutos de degradación severa) y los blips repetidos del Supavisor regional de Supabase (`aws-0-eu-west-2.pooler.supabase.com:6543`) confirmaron una limitación arquitectónica:

**Tanto el primary como el read replica que provisionamos comparten el mismo Shared Pooler regional**. Cuando ese pooler tiene blips, ambas conexiones fallan simultáneamente. La replica AYUDA con CPU/IO contention, pero NO protege contra fallos del pooler regional compartido con otros clientes Supabase.

Verificación en producción:
```
Primary DSN:  aws-0-eu-west-2.pooler.supabase.com:6543
Replica DSN:  aws-0-eu-west-2.pooler.supabase.com:6543  ← MISMA infra
```

Ya tenemos **stale-while-error** en 4 endpoints (theme-stats, problematic-articles, topics, weak-articles) que mitiga 80% del impacto. Pero hay endpoints que NO se pueden cachear (writes, `/api/questions/filtered` POST con random selection, etc.) que siguen sufriendo cada blip.

### Soluciones evaluadas

| Opción | Resuelve blips pooler regional | Coste/mes | Decisión |
|---|---|---|---|
| Supabase Dedicated Pooler | ✅ | ~$100 (estimado) | ❌ caro |
| Self-hosted en Hetzner DE/FI | ✅ | ~$5 | ❌ latencia 15-40ms penaliza UX |
| Self-hosted en AWS eu-west-2 (London) | ✅ | ~$10 | ✅ **elegido** — misma red AWS que Supabase |
| Quedarse con Shared Pooler + stale-while-error | ❌ parcial | $0 | ⚠️ Plan B si fase 0 falla |

### Goals

1. **Aislar nuestro tráfico** de los blips del Supavisor regional compartido
2. **Mantener latencia ≤3ms** a Supabase (igual o mejor que actual)
3. **Coste ≤$15/mes** en arranque, escalable a HA $50/mes después
4. **Rollback instantáneo** vía env var en Vercel en cada fase
5. **Tests rigurosos** antes de tocar producción

---

## Arquitectura propuesta

### Componentes

```
┌─────────────────────────────────────┐
│  Vercel lhr1 (London)               │
│  (200-500 lambdas concurrentes)     │
└──────────────┬──────────────────────┘
               │ TLS (postgresql + sslmode=require)
               │ DATABASE_URL=pooler.vence.es:6543
               ▼
┌─────────────────────────────────────┐
│  AWS Lightsail eu-west-2 (London)   │
│  Ubuntu 24.04 LTS                   │
│  ┌───────────────────────────────┐  │
│  │ Caddy (TLS termination,       │  │
│  │ Let's Encrypt auto)           │  │
│  └─────────────┬─────────────────┘  │
│                │                     │
│  ┌─────────────▼─────────────────┐  │
│  │ PgBouncer                     │  │
│  │ pool_mode=transaction         │  │
│  │ max_client_conn=1000          │  │
│  │ default_pool_size=30          │  │
│  └─────────────┬─────────────────┘  │
│                │                     │
└────────────────┼─────────────────────┘
                 │ TCP/TLS port 5432
                 ▼
┌─────────────────────────────────────┐
│  Supabase Direct Connection         │
│  db.{ref}.supabase.co:5432          │
│  max_connections=90 (Pro plan)      │
└─────────────────────────────────────┘
```

### Por qué Lightsail London y no otros

| Provider | Datacenter London | Latencia a Supabase | Decisión |
|---|---|---|---|
| **AWS Lightsail** | ✅ eu-west-2 | <1-3ms (misma red) | ✅ Elegido |
| AWS EC2 + Terraform | ✅ eu-west-2 | <1-3ms (misma red) | Para Fase 6 (HA) si crecemos |
| Fly.io lhr | ✅ London | 3-5ms | Alternativa válida pero más cara |
| Hetzner | ❌ no London | 15-40ms | ❌ latencia inaceptable |
| Coolify + VPS | Varía | Depende | ❌ overkill para PgBouncer |
| PgCat | — | — | ❌ menos battle-tested que PgBouncer |

### Por qué PgBouncer y no PgCat

- PgBouncer: 15+ años en producción, ~todo el ecosistema PostgreSQL lo usa
- PgCat: 3 años, Rust moderno, pero su feature killer (load balancing primary/replica) ya lo hacemos en app code via `getDb()` vs `getReadDb()`
- Para core infra crítica, **lo battle-tested gana**

### Configuración PgBouncer prevista (10k DAU)

```ini
[databases]
postgres = host=db.{ref}.supabase.co port=5432 dbname=postgres

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 30
reserve_pool_size = 5
reserve_pool_timeout = 3
server_idle_timeout = 600
server_lifetime = 3600
log_connections = 0
log_disconnections = 0
log_pooler_errors = 1
stats_period = 60
```

**Justificación de números**:
- `max_client_conn=1000`: Vercel pico ~500 lambdas × ~2 conn cada una con margen
- `default_pool_size=30`: deja headroom bajo el límite de 90 max_connections de Supabase Pro
- `pool_mode=transaction`: requerido para postgres-js (SDK actual de Drizzle)
- `server_idle_timeout=600`: cierra conexiones idle a Supabase tras 10min para liberar slots

---

## Fases del rollout

> **Principio**: en CADA fase debe existir un rollback testado a Shared Pooler (cambiar 1 env var en Vercel).

### Fase 0 — Provisión inicial 🟡 PENDIENTE

**Objetivo**: tener PgBouncer corriendo y accesible vía DNS, sin tocar producción.

| Quién | Acción |
|---|---|
| Manuel | Crear cuenta AWS si no existe; activar región eu-west-2 |
| Manuel | Crear instancia Lightsail Ubuntu 24.04 LTS, plan $10/mes en London |
| Manuel | Asignar IP estática (incluida en plan) |
| Manuel | DNS: añadir A record `pooler.vence.es` → IP estática Lightsail |
| Claude | Genera `provision-pooler.sh` (instala PgBouncer + Caddy + systemd units + configura) |
| Manuel | Ejecuta script vía SSH |
| Claude | Verifica `psql "postgresql://postgres.{ref}:PASS@pooler.vence.es:6543/postgres"` desde local |

**Criterio de éxito**: conexión exitosa desde local, latencia <50ms desde EU.

**Rollback**: eliminar instancia Lightsail. Coste: $0.

### Fase 1 — Test local + benchmark ⏳

**Objetivo**: validar que el pooler propio iguala o supera al Shared Pooler en métricas.

| Acción | Herramienta | Métrica esperada |
|---|---|---|
| Round-trip SELECT 1 | `psql` time | <5ms |
| Query real (theme-stats) | `psql` time | <500ms warm |
| 100 conn concurrentes | `pgbench -c 100 -T 60` | TPS ≥ Shared Pooler |
| Comparar p50/p95/p99 | manual con timestamps | Latencia ≤ Shared Pooler |

**Criterio de éxito**: paridad o mejora en todas las métricas.

**Rollback**: ninguna acción necesaria — producción intacta.

### Fase 2 — Vercel Preview environment ⏳

**Objetivo**: deploy de una rama de prueba con `DATABASE_URL` apuntando al nuevo pooler en Preview env (NO Production).

| Acción | Detalle |
|---|---|
| Crear rama `feat/self-hosted-pooler-preview` | sin cambios de código |
| Vercel: env var `DATABASE_URL` SOLO en Preview | apuntando a pooler.vence.es |
| Push rama → deploy automático | Vercel genera URL Preview |
| Smoke test exhaustivo: login, dashboard, ranking, test, answer | manual |
| Observar 30-60 min: errores, latencias |  Vercel logs |

**Criterio de éxito**: 0 errores nuevos, latencias normales o mejores.

**Rollback**: borrar la rama → Preview desaparece. Producción intacta.

### Fase 3 — Producción canario (1 endpoint, 24-48h) ⏳

**Objetivo**: validar en tráfico real con un endpoint read-only no crítico.

**Implementación**:

```ts
// db/client.ts — añadir feature flag
export function getPoolerDb() {
  const useSelfHosted = process.env.USE_SELF_HOSTED_POOLER === 'true'
  if (useSelfHosted) {
    return /* cliente con DATABASE_URL_SELF_POOLER */
  }
  return getDb() // fallback Shared Pooler
}
```

**Aplicar a UN endpoint**: `/api/ranking` (read-only, ya tiene cache, low risk).

**Métricas a monitorizar 24-48h**:
- Latencia p50/p95/p99
- Tasa de errores 5xx
- Conexiones activas en pgbouncer (`SHOW POOLS`)
- CPU/RAM de la instancia Lightsail
- Sentry: 0 issues nuevos

**Criterio de éxito**: 24h sin incidentes, métricas iguales o mejores que Shared Pooler.

**Rollback**: env var `USE_SELF_HOSTED_POOLER=false` + redeploy = 30 segundos.

### Fase 4 — Expansión canario (todos los reads) ⏳

**Objetivo**: extender a todos los endpoints read-only que ya tienen `getReadDb()`.

| Endpoint | Estado actual | Acción |
|---|---|---|
| `/api/v2/topic-progress/theme-stats` | replica + stale-while-error | apuntar al pooler propio |
| `/api/notifications/problematic-articles` | replica + stale-while-error | apuntar al pooler propio |
| `/api/ranking` | replica | (Fase 3) |
| `/api/v2/topic-progress/weak-articles` | replica + stale-while-error | apuntar al pooler propio |
| `/api/questions/filtered` POST/GET | replica | apuntar al pooler propio |

**No tocar todavía writes** (`answer-and-save`, `daily-limit`, etc.).

**Criterio de éxito**: 48h sin incidentes con todo el tráfico read pasando por pooler propio.

**Rollback**: feature flag → Shared Pooler en 30s.

### Fase 5 — Producción 100% incl. writes ⏳

**Objetivo**: pooler propio sirve todo el tráfico (reads + writes).

- Migrar `getDb()` (writes) al pooler propio
- Mantener `DATABASE_URL_FALLBACK` con Shared Pooler como emergencia
- Documentar runbook de fallback manual si Lightsail cae

**Criterio de éxito**: 7 días sin incidentes en producción 100% con pooler propio.

### Fase 6 — HA opcional (si necesario) ⏳ FUTURO

**Cuándo**: si tras 1-2 meses con Fase 5 estable detectamos que la instancia única es punto de fallo problemático.

**Implementación**:
- 2× Lightsail en distintas AZs (London tiene `eu-west-2a`, `eu-west-2b`, `eu-west-2c`)
- Network Load Balancer AWS ($18/mes) que reparte conexiones
- Coste total: $20 (2× Lightsail) + $18 (NLB) = ~$40/mes
- Migración a EC2 + Terraform si la complejidad lo justifica

**Criterio para activar Fase 6**: incidente real causado por instancia única caída, o llegamos a >20k DAU.

---

## Análisis de costes

### Coste mensual recurrente

| Componente | Fase 0-5 (single) | Fase 6 (HA) |
|---|---|---|
| Lightsail $10 plan | $10 | $20 (2× instances) |
| Network Load Balancer | $0 (no usa) | $18 |
| Snapshots manuales | $0-2 | $0-4 |
| **TOTAL** | **$10-12** | **~$40-50** |

### Comparación con alternativas

| Opción | Coste/mes | Latencia | Mantenimiento |
|---|---|---|---|
| **Self-hosted Lightsail (este roadmap)** | $10 | ~3ms | 1-2h/mes |
| Supabase Dedicated Pooler | ~$100 (estimado, verificar) | <3ms | 0h |
| Coolify + Hetzner | $5 | 15-40ms ❌ | 1-2h/mes + Coolify updates |
| Quedarse con Shared Pooler | $0 | 3ms | 0h, mitigado con stale-while-error |

**ROI esperado**: si Supabase Dedicated cuesta $100/mes, este setup ahorra ~$1000/año sin sacrificar latencia. Coste de tiempo: ~5h iniciales + 1-2h/mes mantenimiento.

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| **Instancia Lightsail cae** | Baja-Media | Alto si Fase 5 sin HA | Auto-recovery, monitoring + alarms, rollback Shared Pooler en 30s |
| **TLS expirado** (Caddy fallo Let's Encrypt) | Muy baja | Alto | Caddy auto-renueva. Alarma 7 días antes de expirar |
| **PgBouncer config error** | Baja | Alto en deploy | Test exhaustivo en Fase 1-2 antes de producción |
| **Latencia peor que esperada** | Baja | Medio | Validar en Fase 1 antes de continuar |
| **Saturación de pool size** | Baja con tuning correcto | Alto | Monitoring, alertas en `SHOW POOLS`, reserve_pool fallback |
| **Pérdida de la VM** (rare) | Muy baja | Alto | Snapshots manuales semanales, IaC en Git para reproducir en 10 min |
| **Vulnerabilidad Ubuntu/PgBouncer** | Baja | Crítico si exploitable | Auto-updates de seguridad (`unattended-upgrades`) |
| **Rotación password Supabase** | Cierta (cuando ocurra) | Alto si no actualizamos PgBouncer | Runbook documenta el proceso paso a paso |

---

## Plan de rollback

**En CUALQUIER momento durante Fases 3-5**:

1. Vercel Dashboard → Settings → Environment Variables
2. Cambiar `USE_SELF_HOSTED_POOLER=false`
3. Deployments → Redeploy último deploy con cache
4. Vercel desplega en 1-2 minutos
5. Tráfico vuelve al Shared Pooler

**Tiempo total rollback**: <3 minutos.

**Coste de mantener la instancia Lightsail "apagada"**: imposible apagar Lightsail (cobra encendida o stopped). Eliminar = $0/mes.

**Decisión post-rollback**: investigar causa raíz, fix, y reintentar Fase 3 cuando esté listo.

---

## Métricas de éxito del proyecto

Tras Fase 5 estable (1 mes):

| Métrica | Baseline (Shared Pooler) | Objetivo (Self-hosted) |
|---|---|---|
| Blips pooler que causan errores user-facing | ~1-2/semana | **0** (aislado de regional Supavisor) |
| Latencia BD round-trip p95 | 5-15ms (con outliers a 18s) | **<10ms p95**, sin outliers extremos |
| Errores 5xx causados por pool blip | ~10-50/semana | **<5/mes** (solo si Lightsail cae) |
| Coste mensual infra BD-related | $0 extra | $10/mes |

---

## Pendientes (TODO)

- [ ] Fase 0: aprobación + AWS account verificada
- [ ] Generar `provision-pooler.sh` (Claude)
- [ ] Generar `pgbouncer.ini` tuneado (Claude)
- [ ] Generar `Caddyfile` (Claude)
- [ ] Generar systemd units (Claude)
- [ ] Generar runbook operacional (Claude)
- [ ] CI/CD para cambios de config (GitHub Actions)
- [ ] Decidir monitoring backend (CloudWatch vs Better Stack)

## Referencias

- Manual de reembolsos (caso Lucía): `docs/procedures/reembolsos.md` (TRAMPA #1 — por qué cuidado con Stripe ops)
- Roadmap arquitectura: `docs/ARCHITECTURE_ROADMAP.md` Fase 3
- Migration replica: commit `dadb3403`
- Stale-while-error patterns: commits `c1e5ba43` (problematic-articles), `b1e2128b` (topics), `60ba5538` (weak-articles)
- PgBouncer docs: https://www.pgbouncer.org/config.html
- AWS Lightsail London availability: https://aws.amazon.com/lightsail/pricing/
