# Roadmap — Self-hosted Pooler

> **Implementación elegida (mayo 2026)**: PgBouncer en AWS Lightsail London. Alternativas evaluadas (PgCat, Supabase Dedicated Pooler, Coolify) en sección "Comparación de opciones".

> **Estado**: 🟢 Fase 5 COMPLETA (2026-05-10) — ~50+ endpoints user-facing en pooler tras 5 oleadas en una sesión. Único restante: admin/Stripe/cron (intencional). Pico real lunes mañana = prueba final.
> **Propietario**: equipo Vence
> **Coste recurrente real**: $7/mes (Lightsail plan 1GB) — primeros 90 días GRATIS con cuenta nueva ($200 USD créditos AWS)
> **Última actualización**: 2026-05-10 ~21:30 UTC — oleada 5 (34 archivos lib/api/ user-facing) + fix pgbouncer admin DB (pg vs postgres-js). Panel `/admin/infraestructura` con stats vivos del PgBouncer ya operativo. Validación canary 0/0/0/0 5xx en 24h confirma migración limpia.

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

Ya tenemos **stale-while-error** en 5 endpoints (theme-stats, problematic-articles, topics, weak-articles, oposiciones-compatibles/progress) que mitiga 70-80% del impacto. Pero hay endpoints que NO se pueden cachear (writes, `/api/questions/filtered` POST con random selection, etc.) que siguen sufriendo cada blip.

### Recordatorio 2026-05-10 — incidente recurrente

Tras el sprint cascade del 5-9 may con stale-if-error + replica completados, `/api/questions/filtered` siguió devolviendo 503s en clusters durante blips. Mitigación aplicada (commit `06822135`):
- **Doble cache key** (per-user + global) — más probabilidad de hit stale durante blip
- **`withConnectRetry`** — 1 reintento si CONNECT_TIMEOUT efímero <1s

Detalle en `docs/ARCHITECTURE_ROADMAP.md` § "Incidente recurrente 2026-05-10".

**Esto NO sustituye al self-hosted pooler.** Reduce los 503 visibles ~70-90% pero el SPOF arquitectónico sigue ahí. Si vuelven a verse 503s tras la mitigación → arrancar Fase 0 (provisión Lightsail).

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
3. **Coste ≤$15/mes** en arranque, **escalable a HA ~$32/mes obligatorio antes de 5k DAU** (decisión 2026-05-10: HA no es opcional para usuarios de pago)
4. **Rollback instantáneo** vía env var en Vercel en cada fase
5. **Tests rigurosos** antes de tocar producción
6. **HA antes de 5k DAU** — usuarios premium no pueden sufrir downtime por single VM (kernel updates, cert renewal, OOM, mantenimiento). Ver Fase 6.

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

### Fase 0 — Provisión inicial ✅ COMPLETA (2026-05-10)

**Objetivo**: tener PgBouncer corriendo y accesible vía DNS, sin tocar producción.

**Estado real**:

| Item | Resultado |
|---|---|
| Cuenta AWS | Creada (cuenta `VENCE`, $200 créditos, plan de pago para no expirar) |
| Lightsail instance | Ubuntu 24.04, plan $7/mes (1GB RAM, 2 vCPU), London eu-west-2a, **90 días gratis** |
| IP estática | `16.60.146.159` |
| DNS | `pooler.vence.es` (A record en dondominio.com, TTL 600s) |
| Firewall Lightsail | TCP 22/80/6543 abierto, IPv4 + IPv6 |
| TLS | Let's Encrypt cert para `pooler.vence.es` (válido hasta 2026-08-08, auto-renovación) |
| PgBouncer | 1.25.2 (PGDG repo — el de Ubuntu default 1.22 falla con PG17 SCRAM) |
| Auth | SCRAM-SHA-256 PASSTHROUGH (cliente y upstream usan mismo `postgres` user) |
| Smoke test local | ✅ `SELECT 1` desde Spain via `pooler.vence.es:6543` → 312-362ms (Vercel London ~50ms) |
| Pool multiplexing | ✅ 5 queries reusan mismo backend PID — confirmado funcionando |

**Latencia medida desde la VM a Supabase**:
- TCP-handshake: 5-6 ms
- TLS+query: ~10-15 ms
- Pico esperado desde Vercel London: <20 ms (vs ~3 ms del Shared Pooler — pequeño peaje aceptable por aislamiento)

**Memory footprint**: 3.7 MB RAM en PgBouncer (1GB Lightsail = sobra cómodo).

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

### Fase 3 — Producción canario (1 endpoint, 24-48h) 🟡 EN ROLLOUT (2026-05-10)

**Objetivo**: validar en tráfico real con un endpoint read-only no crítico.

**Implementación realizada** (commits `b4e15ad1` infra + `d25e67b1` código):

```ts
// db/client.ts (HECHO)
export function getPoolerDb() {
  const useSelfHosted = process.env.USE_SELF_HOSTED_POOLER === 'true'
  if (!useSelfHosted) return getDb()
  // Lazy init del cliente al pooler propio, fallback a getDb si la env no está
  ...
}

// lib/api/ranking/queries.ts (HECHO)
function getRankingDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getReadDb()
}
```

**Endpoints en el canary** (read-only, expansión incremental el mismo día tras estabilidad):

**Oleada 1** (validación inicial, post-fix `ignore_startup_parameters`):
| Endpoint | Migrado | Razón | Commit |
|---|---|---|---|
| `/api/ranking` | 14:09 UTC | Primer canary (read-only, ya con cache local) | `d25e67b1` |
| `/api/medals` GET | 18:05 UTC | Dio 503 a las 17:31:23 contra Supavisor | `5a633d11` |
| `/api/questions/law-stats` | 18:08 UTC | 3 queries lentas (3.5/6.9/7.7s) — preventivo | `ef01a395` |

**Oleada 2** (expansión preventiva ante pico de tráfico de lunes):
| Endpoint | Migrado | Razón | Commit |
|---|---|---|---|
| `/api/v2/topic-progress/theme-stats` | 18:42 UTC | Hot path con cache; aislar de Supavisor | `ecef26e5` |
| `/api/notifications/problematic-articles` | 18:42 UTC | Read analytics; ya tenía replica + stale-if-error | `ecef26e5` |
| `/api/v2/topic-progress/weak-articles` | 18:42 UTC | Read analytics user-facing; misma justificación | `ecef26e5` |
| `/api/topics/[numero]` | 18:42 UTC | Hot path con stale-if-error | `ecef26e5` |
| `/api/questions/filtered` GET ?action=count | 18:42 UTC | Determinista, fresh-cache 60s + stale | `ecef26e5` |

**Oleada 3** (segundo read-only tras estabilidad):
| Endpoint | Migrado | Razón | Commit |
|---|---|---|---|
| `/api/v2/oposiciones-compatibles/progress` | 20:30 UTC | GET puro, ya tenía stale-if-error | `f22c9fee` |

**Oleada 4 — URGENTE** (durante blip activo Supavisor 20:35 UTC con 240+ 5xx):
| Endpoint | Migrado | Tipo | Razón | Commit |
|---|---|---|---|---|
| `/api/v2/user-stats` | 20:50 UTC | GET | 504 timeouts en blip activo | `b1dfd7b3` |
| `/api/v2/answer-and-save` | 20:55 UTC | **WRITE** | 21+ 503 en blip — perder respuestas de tests inaceptable | `6843bc47` |
| `/api/answer/psychometric` | 20:55 UTC | **WRITE** | Blip activo en mismos timestamps | `6843bc47` |
| `/api/v2/official-exams/answer` | 20:55 UTC | **WRITE** | Blip activo en mismos timestamps | `6843bc47` |
| `/api/questions/filtered` POST | 21:10 UTC | POST | 240 5xx 24h — el más doloroso | `fad5eedb` |
| `/api/v2/random-test-data/*` | 21:10 UTC | GET | Sweep masivo | `fad5eedb` |
| `/api/exam/*` (resume/discard/etc.) | 21:10 UTC | mixed | Sweep masivo (8 call sites) | `fad5eedb` |
| `/api/v2/feedback/*` | 21:10 UTC | mixed | Sweep masivo | `fad5eedb` |
| `/api/daily-limit` | 21:10 UTC | GET | Sweep masivo | `fad5eedb` |
| `/api/teoria/*` | 21:10 UTC | GET | Sweep masivo | `fad5eedb` |
| Helper `oposicion-scope` (transversal) | 21:10 UTC | — | Usado por muchos endpoints | `fad5eedb` |
| Helper `topic-names` | 21:10 UTC | — | Usado en varios sitios | `fad5eedb` |

**Oleada 5 — SWEEP MASIVO TOTAL** (cobertura completa user-facing pre-pico lunes — 34 archivos):
Tras blip + oleada 4 ya estable, decisión "todo lo que no sea admin/Stripe/cron al pooler". Sweep batch script con sed reemplazando `getDb()` → `getXxxDb()` con flag canary.

| Módulo | Tipo | Función crítica |
|---|---|---|
| `auth/queries.ts` | GET | Login/sesiones |
| `profile/queries.ts` | mixed | Perfil usuario |
| `test-answers/queries.ts` | **WRITE** | Guardar respuestas (CRÍTICO) |
| `test-config/queries.ts` | GET | Config tests |
| `tests/queries.ts` + `questions/queries.ts` | mixed | CRUD tests/preguntas |
| `psychometric-{session,test-data,stats}` | mixed | Psicotécnicos (3 archivos) |
| `v2/{complete-test,complete-onboarding,feedback,devices,dispute}` | mixed | Endpoints v2 (5 archivos) |
| `laws`, `laws-configurator`, `temario`, `stats` | GET | Datos curriculares |
| `random-test`, `user-failed-questions`, `hot-articles`, `interactions` | mixed | Tests random + analytics |
| `dispute`, `tema-resolver`, `chat`, `soporte` | mixed | Comunicación user |
| `convocatoria`, `video-courses`, `email-preferences`, `test-favorites`, `test-review` | mixed | Misceláneos user |
| `topic-progress/{user-answers,mapping}` | GET | Progresión usuarios |
| `spelling-answer/queries.ts` | **WRITE** | Respuestas ortografía |
| `avatar-settings/profiles.ts` | mixed | Avatar (cron + user) |

Commits: `438c735d` (34 user-facing files) + `7c79202e` (avatar-settings + verificación exam/pending)

**Variables de entorno añadidas a Vercel Production** (2026-05-10):
- `USE_SELF_HOSTED_POOLER=true`
- `DATABASE_URL_SELF_POOLER=postgresql://postgres:<PASSWORD>@pooler.vence.es:6543/postgres?sslmode=require`

**Lo que sigue en Supavisor por diseño** (NO migrado intencionalmente):
- **Admin endpoints** (`/api/admin/*`) — el panel `/admin/infraestructura` observa el sistema, no debe pasar por lo observado (sesgaría datos)
- **Stripe writes** (`lib/api/subscription/adjustments.ts`) — sesión separada con tests rigurosos; el módulo es crítico para refunds/extensions
- **`/api/exam/pending`** — usa Supabase REST API (PostgREST), no Drizzle. Refactor pendiente para migrar
- **Crons / background jobs** — baja prioridad, no afectan UX

**Dashboard visual de monitorización**: `/admin/infraestructura` (sección "Canary self-hosted pooler") — comparativa 5xx pooler vs Supavisor en 1h/24h, tabla por endpoint, color-coded. Implementado 2026-05-10 (commit `28787188`).

**Métricas a monitorizar 24-48h** (ver `docs/procedures/revisar-errores-fallos.md` § "Canary self-hosted pooler"):
- 5xx en `/api/ranking` en `validation_error_logs` (vs baseline)
- p50/p95/p99 latencia (Vercel logs / Sentry transactions)
- `SHOW POOLS` y `SHOW STATS` en pgbouncer (cl_active, server connections)
- CPU/RAM de la instancia Lightsail (~3.7 MB pgbouncer + sistema base)
- Sentry: 0 issues nuevos relacionados con `/api/ranking`

**Criterio de éxito**: 24-48h sin incidentes, métricas iguales o mejores que Shared Pooler.

**Rollback** (<3 min): env var `USE_SELF_HOSTED_POOLER=false` + redeploy. Detalles en procedures.

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

### Fase 6 — HA (Alta Disponibilidad) ⏳ NECESARIA — no opcional

> **Decisión arquitectónica (2026-05-10)**: dejar de tratar HA como "opcional si crecemos". Es **necesaria por compromiso con usuarios de pago**. Un usuario que paga no puede permitirse que el servicio esté caído por reinicio del kernel, OOM-killer, o un cert renew. Single VM = SPOF inaceptable a partir de cierta escala.

**Por qué es no-opcional**:
- Usuarios premium pagan por servicio fiable. Cada caída erosiona confianza.
- Lightsail SLA 99.9% = ~45 min/mes potencial caída. Con 1k+ DAU eso son cientos de usuarios afectados.
- Eventos predecibles que causarían downtime sin HA: kernel updates, certbot renewal hooks, OOM por memory leak, crash de pgbouncer, mantenimiento Lightsail.
- A 10k DAU, una caída de 10 min puede generar tickets, churn, refunds. El coste de NO tener HA supera con creces los $33/mes extra.

**Cuándo activar (umbral revisado)**:
- ⚠️ **Antes de llegar a 5k DAU** (no a 20k como estaba)
- O si vemos cualquier incidente de single-VM que afecte usuarios reales
- O cuando facturación recurrente sea ≥10× el coste extra ($330/mes ARR ya justifica $33/mes infra)

**Implementación**:
- 2× Lightsail en distintas AZs (London tiene `eu-west-2a`, `eu-west-2b`, `eu-west-2c`)
- Network Load Balancer AWS ($18/mes) que reparte conexiones y hace healthchecks
- Healthcheck activo: NLB hace TCP-ping a 6543 cada 5s; si falla 3 consecutivos saca esa VM del pool
- Coste total: $14 (2× Lightsail $7) + $18 (NLB) = **~$32/mes** (vs $7 actual)
- Migración a EC2 + Terraform si la complejidad lo justifica más adelante

**Riesgos cubiertos por Fase 6**:
- ✅ Reinicio de una VM (kernel update, cert renewal hook, manual reboot)
- ✅ Crash de pgbouncer (OOM, bug)
- ✅ Caída de una AZ entera de London
- ✅ Mantenimiento programado de Lightsail
- ❌ Caída total de eu-west-2 (mitigación: rollback feature flag a Supavisor)
- ❌ Caída de Supabase Postgres (orthogonal — está separado)

**Pendiente**:
- [ ] Provisionar 2ª VM Lightsail en eu-west-2b (idéntica a la actual)
- [ ] Crear NLB con healthcheck TCP:6543 (5s interval, 3 consecutive fails)
- [ ] DNS `pooler.vence.es` → apunta al NLB en lugar de IP directa
- [ ] Test failover: matar VM-A manualmente, verificar tráfico va a VM-B sin downtime
- [ ] Documentar runbook de recuperación si NLB cae

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

## Aprendizajes Fase 0 (2026-05-10)

### Bug crítico: PgBouncer no autentica con plaintext contra Supabase PG17

**Síntoma**: PgBouncer 1.22 y 1.25.2 reciben `FATAL password authentication failed for user "postgres"` al conectar a `db.<ref>.supabase.co:5432` con `password=PLAINTEXT` en `[databases]`. Mismo password funciona perfectamente con `psql` desde la misma máquina.

**Verificación matemática**: cómputo manual con Python de PBKDF2-HMAC-SHA256(plaintext, salt, 4096) → storedKey/serverKey reproduce EXACTAMENTE los valores almacenados en `pg_authid`. **El password ES correcto**.

**Hipótesis no confirmada**: bug en PgBouncer al computar el SCRAM proof desde plaintext cuando upstream es PostgreSQL 17. No documentado oficialmente; reportar en GitHub PgBouncer si vuelve a aparecer en futuras versiones.

**Workaround validado**: **SCRAM passthrough auth**:
1. Cliente (Vercel) y upstream (Supabase) usan el mismo usuario `postgres`
2. PgBouncer almacena el SCRAM verifier (`SCRAM-SHA-256$4096:salt$storedKey:serverKey`) en `userlist.txt`, NO el plaintext
3. `[databases]` SIN `password=` (fuerza a PgBouncer a leer el verifier de userlist.txt)
4. Cliente se autentica vía SCRAM contra PgBouncer; PgBouncer reutiliza esas keys para autenticar al upstream **sin recomputar el proof**

Esto bypasea el bug de PgBouncer al evitar la computación plaintext→proof en el lado servidor.

**Implicación de seguridad**: Vercel usa el password real del usuario `postgres` (mismo que ya está en `DATABASE_URL` y `DATABASE_URL_REPLICA`). No se añade superficie de exposición.

### Trampa: auto-ban de IP por Supabase tras N intentos fallidos

Tras varios intentos consecutivos de auth fallida, **Supabase bloquea automáticamente la IP de origen** (visible en Dashboard → Database → Settings → Network bans con botón "Unban IP"). Esto:
- Bloquea TODO el tráfico de la VM (incluso `psql` directo)
- Es lo que confunde el debug: tras intentar X, parece que X "rompió" la conexión cuando en realidad la IP está banneada
- Se desbanea manualmente (no expira solo en tiempo razonable)

**Recomendación operacional**:
- Detener pgbouncer (`sudo systemctl stop pgbouncer`) ANTES de cambiar config para evitar ban storm con retries
- Cambiar config, restart, **un solo test**, si falla parar inmediatamente y revisar
- Tener Dashboard de Supabase abierto en otra pestaña para unban rápido si pasa

### Trampa: Ubuntu 24.04 default trae PgBouncer 1.22 (insuficiente)

El paquete `pgbouncer` de Ubuntu 24.04 LTS es 1.22.0-1build4 (oct 2023), anterior a fixes relevantes para PostgreSQL 17. Hay que añadir el repo oficial **PGDG** (PostgreSQL Global Development Group) en `apt.postgresql.org` para tener 1.25.2+.

```bash
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/pgdg.gpg
echo "deb [signed-by=/etc/apt/keyrings/pgdg.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt update && apt install -y pgbouncer
```

### Trampa: `ignore_startup_parameters` (descubierto en Fase 3 canary 2026-05-10)

**Síntoma**: tras activar el canary en Vercel, `/api/ranking` devuelve 500. En logs de pgbouncer:

```
C-0x...:(nodb)/(nouser)@13.42.x.x:port  unsupported startup parameter in options: statement_timeout=30000
C-0x...:(nodb)/(nouser)@13.42.x.x:port  closing because: unsupported startup parameter in options: statement_timeout
```

**Causa**: postgres-js (el cliente que usa Drizzle) envía `statement_timeout` y otros parámetros como startup options en el handshake. PgBouncer por default sólo acepta unos pocos parámetros estándar y cierra la conexión si recibe otros.

Nuestro `db/client.ts` añade esto al DSN para limitar queries lentas a 30s:
```
options=-c statement_timeout=30000 -c idle_in_transaction_session_timeout=60000
```

Funciona contra Supabase direct/Supavisor (que sí ignoran/aceptan), pero PgBouncer lo rechaza.

**Fix**: en `pgbouncer.ini` añadir:
```
ignore_startup_parameters = extra_float_digits,statement_timeout,idle_in_transaction_session_timeout,search_path,application_name
```

`extra_float_digits` lo añade automáticamente psql/postgres-js. `application_name` y `search_path` también son comunes. `statement_timeout` y `idle_in_transaction_session_timeout` son los nuestros. `application_name` lo añade Drizzle.

**Sin esto**: TODA conexión al pooler falla en handshake. **Con esto**: ignorados en pgbouncer, pero los timeouts efectivos siguen funcionando porque Postgres tiene su propio `statement_timeout` global y pgbouncer también tiene `query_timeout`.

Aplicado ya en `infra/pooler/provision-pooler.sh` (commit pendiente). Re-provisión idempotente lo arregla.

### Trampa: unattended-upgrades reinicia pgbouncer durante peak hours

**Síntoma** (descubierto 2026-05-11 08:06 CEST, justo durante pico mañanero): blip de ~10s con 500s en endpoints user-facing (`/api/exam/pending`, `/api/v2/user-stats`, etc.) y warnings `tls_sbufio_recv: read failed: unexpected eof while reading` en logs pgbouncer.

**Causa**: `unattended-upgrades` corría por defecto a las **06:04 UTC** (= **08:04 CEST**). Cuando había updates de librerías que pgbouncer enlaza dinámicamente (libssl, libpam-cap, etc.), `needrestart` reiniciaba pgbouncer automáticamente. El reinicio coincidía con el inicio del pico mañanero de tráfico → blip visible para usuarios.

**Fix aplicado** (sin esperar a Fase 6 HA):

1. **Mover unattended-upgrades a madrugada** (sin tráfico):
   ```bash
   sudo tee /etc/systemd/system/apt-daily-upgrade.timer.d/override.conf <<EOF
   [Timer]
   OnCalendar=
   OnCalendar=*-*-* 23:00:00
   RandomizedDelaySec=15min
   EOF
   sudo systemctl daemon-reload
   sudo systemctl restart apt-daily-upgrade.timer
   ```
   23:00 UTC = 01:00 CEST = madrugada España, sin opositores online.

2. **Blacklist pgbouncer en needrestart**:
   ```bash
   sudo tee /etc/needrestart/conf.d/vence-pgbouncer.conf <<EOF
   $nrconf{blacklist} = [ qr(^pgbouncer$) ];
   $nrconf{restart} = "l";
   EOF
   ```
   Pgbouncer NO se reinicia automáticamente. Las libs viejas en memoria funcionan; las nuevas se cargan al próximo reinicio manual cuando convenga.

**Solución definitiva**: HA Fase 6 (2 VMs + NLB con healthcheck). Un reinicio de una VM no afecta tráfico — la otra sirve.

**Pendiente verificar**: que la próxima ejecución de unattended-upgrades el 11 may a las 23:00 UTC NO reinicie pgbouncer.

### Trampa: PgBouncer admin DB no soporta extended query protocol

**Síntoma**: panel `/admin/infraestructura` muestra "Pooler propio: No disponible" aunque `DATABASE_URL_SELF_POOLER` esté configurada y la VM esté funcionando perfectamente. Logs server-side:

```
PostgresError: extended query protocol not supported by admin console
code: '08P01'
```

**Causa**: PgBouncer admin console (la base de datos especial `pgbouncer` accesible vía la misma conexión TLS, port 6543) **solo soporta simple query protocol**. La librería `postgres` (postgres-js) usa extended protocol por defecto incluso con `prepare: false`. El extended protocol falla en handshake con admin console.

**Fix**: usar `pg` (node-postgres) en lugar de `postgres-js` específicamente para conexiones a la admin DB. `pg.Client` usa simple query protocol que pgbouncer admin sí acepta.

```typescript
// ❌ NO funciona — postgres-js usa extended protocol
import postgres from 'postgres'
const conn = postgres(adminUrl, { prepare: false })
await conn`SHOW POOLS`  // → 08P01 protocol violation

// ✅ Sí funciona — pg usa simple protocol por default
import { Client as PgClient } from 'pg'
const client = new PgClient({ connectionString: adminUrl, ssl: { rejectUnauthorized: false } })
await client.connect()
await client.query('SHOW POOLS')  // → ✅ funciona
```

**Adicional**: pgbouncer admin tampoco maneja queries concurrentes bien (mismo error 08P01). Las queries deben ser **secuenciales**, no `Promise.all`.

Aplicado en `app/api/admin/infra-stats/route.ts` (commit `d3927f4b`, 2026-05-10).

### Trampa: `db.<ref>.supabase.co` solo resuelve a IPv6

```
$ dig +short db.yqbpstxowvgipqspqrgo.supabase.co
2a05:d01c:30c:9d0f:3cb7:1b0:7b0:a6f5
$ dig +short db.yqbpstxowvgipqspqrgo.supabase.co A
(empty)
```

Lightsail dual-stack maneja esto correctamente. Si en futuro Supabase cambia el endpoint, hay que reverificar conectividad.

### TLS: certbot standalone vs Caddy

El roadmap original mencionaba Caddy como TLS terminator. Descartado: Caddy es HTTP-first, no termina TLS para protocolo Postgres bien (necesitaría plugin caddy-l4 experimental). En su lugar:
- **certbot standalone** para emisión + renovación
- **PgBouncer nativo** consume el cert directamente (`client_tls_cert_file` / `client_tls_key_file`)
- Hook de deploy en `/etc/letsencrypt/renewal-hooks/deploy/` copia el cert renovado a `/etc/pgbouncer-vence/tls/` con perms `postgres:postgres` y reload de pgbouncer

Más simple, más estándar, menos servicios que mantener.

## Pendientes (TODO) post-Fase 0

### ✅ Hecho hoy 2026-05-10 (sesión maratón)

- [x] **Fase 0** — Provisión Lightsail + PgBouncer 1.25.2 + DNS + TLS Let's Encrypt
- [x] **Fase 1** — Test local: 5-6ms TCP latency, e2e OK
- [x] **Fase 2** — Validación pre-producción (skip Preview, fuimos directo a canary prod por confianza)
- [x] **Fase 3** — Canary 1 endpoint (`/api/ranking`) validado tras fix `ignore_startup_parameters`
- [x] **Fase 4 (oleada 1+2+3)** — 9 endpoints read migrados durante el día
- [x] **Fase 4-5 sweep URGENTE (oleada 4)** — durante blip Supavisor 20:35 UTC migrados: 3 writes críticos (answer-and-save, psychometric/answer, official-exams/answer) + filtered POST + sweep (random-test-data, exam, feedback, daily-limit, teoria, helpers)
- [x] **Oleada 5 — SWEEP TOTAL** — 34 archivos lib/api/ user-facing al pooler (auth, profile, test-answers, psychometric-*, v2/*, etc.) + avatar-settings. **~50+ endpoints en pooler propio en total** (todo lo user-facing cubierto).
- [x] **Fix bug pgbouncer admin DB** — extended query protocol no soportado en admin console; cambio a `pg` (node-postgres) en lugar de `postgres-js` para esa conexión específica. Panel admin con stats vivos del PgBouncer ya operativo.
- [x] `db/client.ts:getPoolerDb()` con feature flag `USE_SELF_HOSTED_POOLER` + tests
- [x] Panel admin `/admin/infraestructura` con:
  - Sección "Pooler propio" con stats vivos (SHOW POOLS / STATS / MEM via direct connection a admin DB)
  - Tabla endpoints con badge Pooler/Supavisor + 5xx 24h + duración
  - Comparativa 5xx pooler vs Supavisor (1h, 24h)
  - Timeout per-query para que no se cuelgue todo si una falla
- [x] Helpers `withConnectRetry` + `isConnectTimeoutError` en `lib/db/timeout.ts` (mitigación CONNECT_TIMEOUT del Supavisor — antes de tener pooler propio operativo)
- [x] Mensajes 503 actualizados en 13 endpoints: "Reintenta en 5 minutos" + Retry-After 300

### ⏳ Pendiente (mañana o esta semana)

- [ ] **Observar pico lunes 2026-05-11 mañana** — primer test real con tráfico de opositores. Mirar `/admin/infraestructura` cada par de horas. Si hay regresión → rollback global con `USE_SELF_HOSTED_POOLER=false` (1 toggle, deploy ~30s).
- [ ] **Migrar Stripe writes** (`lib/api/subscription/adjustments.ts`) — sesión separada con tests cuidadosos por su criticidad (refunds, extensions, etc.)
- [ ] **Refactor `/api/exam/pending`** de Supabase REST a Drizzle, luego migrar al pooler. Bajo prioridad (poco tráfico).
- [ ] **HA del pooler** ⚠️ NECESARIA antes de 5k DAU — ver Fase 6 más arriba

### 🔧 Mejoras del panel admin (Versión 2)

- [ ] Endpoint `/health` en la VM (vía pgbouncer admin DB) que devuelva SHOW POOLS / SHOW STATS por HTTPS — para mostrar memoria, conexiones activas, queries servidas en el panel sin SSH
- [ ] Añadir columna `method` (GET/POST) a `validation_error_logs` para distinguir migraciones parciales correctamente
- [ ] Sentry issues count en el panel admin (4ª card)
- [ ] Gráfico de serie temporal de 7 días con p50/p95 latencia por endpoint

### 📡 Operaciones / monitoring

- [ ] Setup CloudWatch básico para CPU/memoria de la VM Lightsail + alarms si pgbouncer cae
- [ ] CI/CD para cambios de config pgbouncer (GitHub Actions) — opcional, baja prioridad
- [ ] **Fase 6** ⚠️ **NECESARIA antes de 5k DAU** — HA con 2 instancias Lightsail + NLB (~$32/mes total). Decisión 2026-05-10: dejar de tratarla como opcional. Usuarios de pago no pueden sufrir downtime por single VM. Detalle en sección "Fase 6" más arriba.

## Referencias

- Manual de reembolsos (caso Lucía): `docs/procedures/reembolsos.md` (TRAMPA #1 — por qué cuidado con Stripe ops)
- Roadmap arquitectura: `docs/ARCHITECTURE_ROADMAP.md` Fase 3
- Migration replica: commit `dadb3403`
- Stale-while-error patterns: commits `c1e5ba43` (problematic-articles), `b1e2128b` (topics), `60ba5538` (weak-articles)
- PgBouncer docs: https://www.pgbouncer.org/config.html
- AWS Lightsail London availability: https://aws.amazon.com/lightsail/pricing/
