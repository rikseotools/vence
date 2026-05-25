# Manual de Observabilidad — Vence

> **Estado:** MVP funcional desde 2026-05-25 (tabla `observable_events`, 2 escritores activos). Este manual documenta filosofía + estado actual + roadmap. Vivo — actualizar cada vez que se añada una capa.

## 1. Por qué observabilidad es CRÍTICO (no un nice-to-have)

**Sin observabilidad activa:** te enteras de los bugs por feedback de usuarios. Tarde — el usuario ya se frustró, abandonó la sesión, dejó review mala. El % de usuarios que reporta un bug es <5% del total que lo sufre. El resto se va en silencio.

**Con observabilidad activa:** te enteras del bug en minutos. Antes de que la mayoría de usuarios lo vea. Antes del primer review malo.

La observabilidad **multiplica el rendimiento del equipo de producto**:
- Detección proactiva de regresiones tras deploy
- Priorización basada en impacto real (no en quién grita más)
- Validación de hipótesis técnicas con datos
- Reducción del MTTR (mean time to recovery) de horas a minutos
- Confianza para mover rápido (rollback automático si SLO se rompe)

**Tres niveles de madurez:**

| Nivel | Qué cubre | Cuándo te enteras del bug |
|---|---|---|
| 1. Reactivo | Logs cuando un user reporta | Días después, vía email |
| 2. Pasivo | Logs persistentes consultables | Cuando alguien va a buscar |
| 3. **Activo** | Eventos + alertas + dashboards | Minutos. Antes del 2º usuario afectado |

Vence está hoy entre nivel 1 y 2. **El objetivo es nivel 3.**

---

## 2. Arquitectura — visión general

### Capas físicas

```
┌──────────────────────────────────────────────────────┐
│  CLIENT (browser)                                    │
│  console.error, JS exceptions, hydration, API fails  │
└────────┬─────────────────────────────────────────────┘
         │ POST /api/observability/ingest (con sampling)
         ▼
┌──────────────────────────────────────────────────────┐
│  VERCEL (Next.js lambdas)                            │
│  lib/observability/emit.ts → INSERT directo BD       │
└────────┬─────────────────────────────────────────────┘
         │
         │  ┌────────────────────────────────────────┐
         │  │  FARGATE (NestJS)                      │
         │  │  ObservabilityService → INSERT directo │
         │  └─────────────┬──────────────────────────┘
         │                │
         │                │  ┌──────────────────────┐
         │                │  │ GHA workflows        │
         │                │  │ curl → ingest        │
         │                │  └──────┬───────────────┘
         ▼                ▼         ▼
┌──────────────────────────────────────────────────────┐
│  Postgres — public.observable_events                 │
│  Una sola tabla, 4 índices, retención 30d            │
└────────┬─────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  Dashboard admin /admin/observability  (futuro)      │
│  Filtros: source / severity / event_type / time      │
└──────────────────────────────────────────────────────┘
```

### Shape de un evento

```typescript
{
  id: uuid,              // gen_random_uuid() automático
  ts: timestamptz,       // default NOW()
  source: 'vercel' | 'fargate' | 'gha' | 'frontend',
  severity: 'debug' | 'info' | 'warn' | 'error' | 'critical',
  event_type: string,    // 'http_5xx', 'cron_run', 'deploy', ...
  endpoint?: string,
  user_id?: uuid,
  deploy_version?: string,
  duration_ms?: integer,
  http_status?: integer,
  error_message?: text,
  metadata?: jsonb,      // libre — campos específicos del event_type
}
```

### Decisiones de diseño

| Decisión | Por qué |
|---|---|
| **Tabla Postgres única** (no Elasticsearch / CloudWatch propietario) | Standard SQL. Portable. Las queries time-series rinden bien con índices BTREE básicos hasta 100M filas |
| **Writers escriben directo vía Drizzle** (no via HTTP) | 0 latencia añadida. 0 nuevo servicio. Cross-runtime coherente — frontend y backend usan misma BD |
| **`event_type` texto libre** (no enum) | Añadir nuevo tipo no requiere migración. Cuando estabilice, migrar a enum |
| **`metadata jsonb`** | Campos específicos del event_type sin migración constante |
| **Fire-and-forget** (no bloquea respuesta) | Observabilidad NUNCA debe romper requests reales |
| **Retención 30d** | Suficiente para investigación postmortem. Más allá → archivo a S3 (futuro) |

---

## 3. Estado actual (2026-05-25)

### ✅ Implementado

| Pieza | Ubicación | Estado |
|---|---|---|
| Tabla `observable_events` + índices | Migración `database/migrations/2026-05-25-observable-events.sql` | Aplicada en prod |
| Frontend emit | `lib/observability/emit.ts` (`emit`, `emitFireAndForget`) | Live |
| Backend emit | `backend/src/observability/observability.service.ts` | Live |
| Helper severity normalization | `normalizeSeverity()` en ambos lados | Live |
| Cron `refresh-rankings` emite | `backend/src/refresh-rankings/refresh-rankings.cron.ts` | Live, 288 eventos/día |
| Espejo `validation_error_logs` → `observable_events` | `lib/api/validation-error-log/queries.ts:_insertLog` | Live |
| `incrementCounter()` para versioned cache | `lib/cache/redis.ts` | Live |

### ⏳ Pendiente (gaps)

**Capa 1 — más writers (fácil/medio)**

| Falta | Esfuerzo |
|---|---|
| 12 crons Fargate restantes con `obs.emitFireAndForget` (archive-interactions, check-boe-changes, update-streaks, process-outbox, avatar-rotation, etc.) | 5-10 min × 12 con helper común |
| **Interceptor global NestJS** que emita errores ≥500 del backend | 30 min |
| **Endpoint `/api/observability/ingest`** (gateway HTTP — GHA, deploy hooks, client-side) | 45 min |
| **Client-side observability** (ver §4) | 1-2h |
| 4 crons Vercel Grupo B (close-inactive-feedback, renewal-reminders, etc.) emitiendo via ingest | 10 min × 4 |

**Capa 2 — métricas de éxito (no solo errores)**

| Falta | Esfuerzo |
|---|---|
| Latencia p50/p95 por endpoint (success requests) | 1h (decorator) |
| Cache hit/miss ratio agregado | 30 min |
| ALB target metrics → observable_events | 1h |

**Capa 3 — operacional**

| Falta | Esfuerzo |
|---|---|
| Cron poda 30d (`DELETE WHERE ts < NOW() - 30 days`) | 15 min |
| Dashboard admin `/admin/observability` | 2-3h |
| Vistas materializadas (`observable_events_hourly_summary`) | 30 min |
| Alertas activas (cron que detecte anomalías y notifique) | 1-2h |

**Capa 4 — siguiente nivel**

| Falta | Esfuerzo |
|---|---|
| Tracing distribuido (OpenTelemetry) | 1-2 días |
| SLOs declarados + medidos | 1h × SLO |
| Correlation IDs request → background tasks | 1 día |

---

## 4. ⭐ Client-side observability (consolas de usuarios)

> **Sección crítica:** la mayoría de bugs visibles para el usuario NUNCA llegan al servidor. Errores JS en el navegador, hydration mismatches, API failures con `fetch()`, errores de React boundaries — todo eso muere en la consola del usuario. **Sin captura activa, el bug se silencia.**

### Lo que queremos capturar

| Tipo | Ejemplo | Cómo capturarlo |
|---|---|---|
| **JS uncaught errors** | `TypeError: Cannot read 'x' of undefined` | `window.onerror` / `window.addEventListener('error')` |
| **Unhandled promise rejections** | `fetch().then()` sin `.catch()` | `window.addEventListener('unhandledrejection')` |
| **React component errors** | render() lanza | `<ErrorBoundary>` componente envolvente |
| **Hydration mismatches** | server HTML ≠ client | React 19 logs, capturar via console patch |
| **API call failures** | fetch a /api/foo devuelve 5xx | wrapper sobre `fetch()` que reporta |
| **Manual `console.error`** | código que loguea explícitamente | patch sobre `console.error` |

### Diseño propuesto (no implementado todavía)

**Archivo: `lib/observability/client.ts`** — instalación única en `app/layout.tsx`:

```typescript
// lib/observability/client.ts
'use client'

const SAMPLE_RATE = 1.0 // 100% en MVP — bajar a 0.1 si volumen
const BUFFER_FLUSH_MS = 5000
const buffer: ClientEvent[] = []

interface ClientEvent {
  ts: string
  severity: 'error' | 'warn'
  eventType: 'js_uncaught' | 'unhandled_rejection' | 'react_error_boundary'
              | 'console_error' | 'fetch_failure' | 'hydration_mismatch'
  errorMessage: string
  metadata: {
    url: string         // URL actual (path solo, no querystring con PII)
    userAgent: string
    stack?: string      // truncado a 2000 chars
    componentStack?: string  // para React Error Boundary
    httpStatus?: number      // para fetch_failure
  }
}

export function installClientObservability(userId?: string) {
  if (typeof window === 'undefined') return

  // 1) Uncaught errors globales
  window.addEventListener('error', (event) => {
    pushEvent({
      severity: 'error',
      eventType: 'js_uncaught',
      errorMessage: event.message.slice(0, 500),
      metadata: {
        stack: event.error?.stack?.slice(0, 2000),
        filename: event.filename,
        line: event.lineno,
        col: event.colno,
      },
    }, userId)
  })

  // 2) Promise rejections sin catch
  window.addEventListener('unhandledrejection', (event) => {
    pushEvent({
      severity: 'error',
      eventType: 'unhandled_rejection',
      errorMessage: String(event.reason).slice(0, 500),
      metadata: { stack: event.reason?.stack?.slice(0, 2000) },
    }, userId)
  })

  // 3) console.error patch (capturar logs explícitos)
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    origConsoleError(...args)
    pushEvent({
      severity: 'warn',
      eventType: 'console_error',
      errorMessage: args.map((a) => String(a)).join(' ').slice(0, 500),
      metadata: {},
    }, userId)
  }

  // 4) Flush on unload — el navegador puede cerrar antes del próximo flush
  window.addEventListener('beforeunload', () => flush(true))

  // 5) Flush periódico
  setInterval(() => flush(false), BUFFER_FLUSH_MS)
}

function pushEvent(partial: Omit<ClientEvent, 'ts' | 'metadata'> & {
  metadata: Partial<ClientEvent['metadata']>
}, userId?: string) {
  if (Math.random() > SAMPLE_RATE) return // sampling

  buffer.push({
    ts: new Date().toISOString(),
    ...partial,
    metadata: {
      url: location.pathname,
      userAgent: navigator.userAgent.slice(0, 200),
      ...partial.metadata,
    },
  })

  if (buffer.length >= 10) flush(false) // flush si lleno
}

function flush(useBeacon: boolean) {
  if (buffer.length === 0) return
  const events = buffer.splice(0, buffer.length)
  const body = JSON.stringify({ events })

  // navigator.sendBeacon SIGUE funcionando en beforeunload (fetch no garantiza)
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/observability/ingest', body)
  } else {
    fetch('/api/observability/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // si falla, NO retry para no spam — el evento se pierde (aceptable)
    })
  }
}
```

**React Error Boundary** (`components/ObservabilityBoundary.tsx`):

```typescript
'use client'
import { Component, type ReactNode } from 'react'

export class ObservabilityBoundary extends Component<{ children: ReactNode }> {
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    fetch('/api/observability/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events: [{
          ts: new Date().toISOString(),
          severity: 'error',
          eventType: 'react_error_boundary',
          errorMessage: error.message.slice(0, 500),
          metadata: {
            url: location.pathname,
            stack: error.stack?.slice(0, 2000),
            componentStack: info.componentStack?.slice(0, 2000),
          },
        }],
      }),
      keepalive: true,
    }).catch(() => {})
  }
  render() { return this.props.children }
}
```

**Instalación en `app/layout.tsx`:**

```typescript
'use client'
import { useEffect } from 'react'
import { installClientObservability } from '@/lib/observability/client'

export default function RootLayout({ children }) {
  useEffect(() => {
    installClientObservability(/* userId si está logueado */)
  }, [])
  // ...
}
```

### Privacy & PII

**REGLA DE ORO:** los eventos client-side NUNCA deben incluir contenido sensible.

| Permitido | Prohibido |
|---|---|
| `location.pathname` (`/test/aleatorio`) | `location.search` (puede tener `?email=...`) |
| `userAgent` | Cookies, tokens, headers |
| Error stack (código, no datos) | Contenido de inputs (`<input value="...">`) |
| `userId` (UUID anónimo) | Email, nombre, DNI |
| Mensaje de error truncado a 500 chars | localStorage / sessionStorage completos |

Si capturas algo que pueda tener PII (ej. argumentos pasados a `console.error`), **trunca a 500 chars Y censura patrones obvios** (regex sobre emails, números largos, JWT tokens).

### Sampling

A 10k DAU con `SAMPLE_RATE=1.0` → potencialmente **millones de eventos/día** si hay un bug viral. Insostenible.

Estrategia:
- **MVP**: `SAMPLE_RATE = 1.0` (100%) — necesario hasta validar volumen real
- **Tras 1 semana**: medir volumen y ajustar:
  - `js_uncaught` / `unhandled_rejection`: 100% (bajo volumen, alta señal)
  - `console_error`: 10% (alto volumen, ruido medio)
  - `fetch_failure`: 100% (alta señal)
- **Si un único error explota** (ej. bug en deploy): rate-limit por `errorMessage` hash (ej. máx 100 eventos del mismo mensaje en 1h)

### Coexistencia con Sentry

Vence ya tiene Sentry. **No reemplazar — espejar.** Sentry tiene UI buena para client-side stacks; `observable_events` tiene queries SQL flexibles.

Dos opciones:
1. **Mantener Sentry para client + observable_events solo server** (status quo + capas separadas)
2. **Webhook Sentry → `/api/observability/ingest`** que espeje todos los eventos de Sentry a la tabla (unifica)

Recomendación: **(2)** cuando esté el endpoint ingest. Sentry retiene 30 días gratis; `observable_events` retiene 30 días también; la unión gives best of both.

---

## 5. Cómo emitir desde código

### Frontend (Next.js / Vercel)

```typescript
import { emit, emitFireAndForget } from '@/lib/observability/emit'

// En route handler async
await emit({
  source: 'vercel',
  severity: 'error',
  eventType: 'rate_limit_exceeded',
  endpoint: '/api/v2/answer-and-save',
  userId: user.id,
  metadata: { dailyLimit: 25, current: 26 },
})

// En catch blocks no-async (devuelve void)
emitFireAndForget({
  source: 'vercel',
  severity: 'warn',
  eventType: 'background_task_failure',
  errorMessage: err.message,
})
```

### Backend (NestJS / Fargate)

```typescript
import { ObservabilityService } from '../observability/observability.service'

constructor(private readonly obs: ObservabilityService) {}

// async
await this.obs.emit({
  source: 'fargate',
  severity: 'info',
  eventType: 'cron_run',
  endpoint: 'my-cron',
  durationMs: elapsed,
  metadata: { processed: 100 },
})

// fire-and-forget
this.obs.emitFireAndForget({
  source: 'fargate',
  severity: 'error',
  eventType: 'http_5xx',
  errorMessage: err.message,
})
```

### Convención `event_type`

| Categoría | Eventos válidos |
|---|---|
| HTTP | `http_4xx`, `http_5xx`, `http_timeout`, `http_aborted` |
| Crons | `cron_run` (con `metadata.status: success/failure`) |
| Auth | `auth_failed`, `rate_limit_exceeded`, `device_limit_exceeded` |
| Cache | `cache_invalidation`, `cache_miss_storm` |
| Deploys | `deploy_started`, `deploy_completed`, `deploy_failed` |
| Cliente | `js_uncaught`, `unhandled_rejection`, `react_error_boundary`, `console_error`, `fetch_failure`, `hydration_mismatch` |
| Negocio | `payment_failed`, `signup_completed`, `daily_limit_reached` |

Si necesitas uno nuevo: añádelo aquí + úsalo. Cuando estabilice (todos los callers usan el mismo string), considerar migrar a enum.

---

## 6. Cómo consultar eventos

### Queries básicas (psql / Drizzle)

```sql
-- Errores 5xx última hora
SELECT ts, endpoint, error_message, deploy_version
FROM observable_events
WHERE source = 'vercel' AND event_type = 'http_5xx' AND ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC;

-- Eventos por minuto última hora (sparkline)
SELECT DATE_TRUNC('minute', ts) AS minuto, COUNT(*) AS n
FROM observable_events
WHERE ts > NOW() - INTERVAL '1 hour'
GROUP BY 1 ORDER BY 1;

-- Top endpoints con errores hoy
SELECT endpoint, COUNT(*) AS n
FROM observable_events
WHERE severity IN ('error', 'critical') AND ts >= CURRENT_DATE
GROUP BY endpoint ORDER BY n DESC LIMIT 10;

-- Crons que fallaron hoy
SELECT endpoint AS cron, ts, error_message
FROM observable_events
WHERE event_type = 'cron_run'
  AND severity = 'error'
  AND ts >= CURRENT_DATE;

-- Latency p95 por endpoint últimas 24h
SELECT endpoint,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95,
       COUNT(*) AS n
FROM observable_events
WHERE ts > NOW() - INTERVAL '24 hours' AND duration_ms IS NOT NULL
GROUP BY endpoint ORDER BY p95 DESC LIMIT 20;
```

### Desde el CLI (durante incident response)

```bash
node -e "
const pgMod = require('/home/manuel/Documentos/github/vence/node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('/home/manuel/Documentos/github/vence/node_modules/dotenv').config({path:'/home/manuel/Documentos/github/vence/.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
(async () => {
  const r = await sql\`SELECT ts, source, severity, event_type, endpoint, error_message
                       FROM observable_events
                       WHERE ts > NOW() - INTERVAL '30 minutes'
                         AND severity IN ('error', 'critical')
                       ORDER BY ts DESC LIMIT 30\`;
  for (const x of r) console.log(x.ts.toISOString(), x.source, x.severity, x.event_type, x.endpoint, '|', x.error_message?.slice(0,80));
  await sql.end();
})();
"
```

---

## 7. Alertas activas (futuro — Capa 3)

Diseño propuesto: un cron Fargate `@Cron('*/5 * * * *')` que ejecute reglas:

```typescript
// backend/src/observability-alerts/alerts.cron.ts
const RULES = [
  {
    name: '5xx_spike',
    severity: 'critical',
    sql: `SELECT COUNT(*) FROM observable_events
          WHERE event_type IN ('http_5xx', 'http_timeout')
            AND ts > NOW() - INTERVAL '5 minutes'`,
    threshold: (n: number) => n > 20,
    cooldownMin: 30, // no spam-alertar
  },
  {
    name: 'cron_overdue',
    severity: 'critical',
    sql: `SELECT endpoint, EXTRACT(EPOCH FROM (NOW() - MAX(ts))) AS staleness_s
          FROM observable_events
          WHERE event_type = 'cron_run'
          GROUP BY endpoint`,
    check: (rows) => rows.filter((r) => r.staleness_s > expectedInterval(r.endpoint) * 2),
  },
  // más reglas...
]
```

Cada regla que dispara → email/Telegram al admin (notification_events table).

---

## 8. Dashboard admin (futuro — Capa 3)

Path: `/admin/observability`. UI:

```
┌──────────────────────────────────────────────────────────────┐
│ Observabilidad — últimas 24h                                 │
├──────────────────────────────────────────────────────────────┤
│ Filtros: [Source ▼] [Severity ▼] [Event type ▼] [⏱ Range ▼] │
├──────────────────────────────────────────────────────────────┤
│ ▲ 3450 eventos                                               │
│ ┌────────────────────────────────────────────────┐           │
│ │ ▁▁▁▁▂▂▃▃▄▄▅▅▆▆▇▇█▇▆▅▄▃▂▂▁▁ (sparkline)        │           │
│ └────────────────────────────────────────────────┘           │
├──────────────────────────────────────────────────────────────┤
│ Top error_messages (24h)                                     │
│   1. "Connection timeout"           × 47   /api/foo          │
│   2. "JWT expired"                  × 23   /api/v2/...       │
│   ...                                                        │
├──────────────────────────────────────────────────────────────┤
│ Stream (auto-refresh 10s)                                    │
│ 10:42:13 [vercel/error] http_5xx /api/answer-and-save       │
│ 10:42:08 [fargate/info] cron_run refresh-rankings 1542ms    │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

Inspiración: Sentry Issues + Grafana Loki + CloudWatch Logs Insights combinados.

---

## 9. SLOs (futuro — Capa 4)

Declarar SLOs explícitos para cada endpoint crítico. Ejemplo:

```yaml
# docs/architecture/slos.yml
endpoints:
  /api/v2/answer-and-save:
    availability: 99.9%
    latency_p95_ms: 500
    error_budget_window: 30d

  /api/v2/test-config/articles:
    availability: 99.5%
    latency_p95_ms: 200
    cache_hit_ratio_min: 0.85
```

Cron diario que mide vs SLO desde `observable_events` y emite **otro evento** `slo_breach` si se incumple.

**Error budget:** "podemos romper hasta X errores este mes". Si ya rompimos el 80%, **freezar deploys** hasta el siguiente periodo. Quita el tema político de "rollback sí o no" — el dato lo decide.

---

## 10. Migración Sentry → observable_events (futuro)

Webhook de Sentry → `POST /api/observability/ingest` con shared secret. Cada Sentry issue/event se espeja a la tabla.

Ventajas:
- UI de Sentry para deep-dive (stacks, contextual breadcrumbs)
- SQL queries flexibles sobre `observable_events` para reportes / dashboards / alertas
- Una sola fuente para correlacionar Sentry con eventos backend

Implementación: 1-2h (Sentry webhook config + endpoint ingest que normalice el payload Sentry a shape de `observable_events`).

---

## 11. Roadmap priorizado

Orden recomendado (impacto descendente):

1. **Endpoint `/api/observability/ingest`** (gateway HTTP universal) — 45 min
   - Desbloquea: client-side, GHA, Vercel deploy hooks, futuro Sentry webhook
2. **Interceptor global NestJS** errores ≥500 backend — 30 min
   - Cierra agujero de errores backend ausentes en BD
3. **Client-side observability** (consolas usuarios) — 1-2h
   - Lo que el usuario quiere — bugs JS detectados sin esperar feedback
4. **Migración batch 12 crons Fargate a emit** — 1h (con helper común)
5. **Cron poda 30d** — 15 min
6. **Dashboard admin `/admin/observability`** — 2-3h
   - El ROI más visible
7. **Alertas activas** (cron rules engine) — 1-2h
8. **Migración Sentry → observable_events via webhook** — 1-2h
9. **SLOs declarados + medidos** — 1h × SLO
10. **Tracing distribuido (OpenTelemetry)** — 1-2 días
   - Solo cuando los otros estén cubiertos

---

## 12. Notas técnicas adicionales

### Por qué NO usamos un servicio dedicado (Datadog, New Relic, etc.)

| Razón |
|---|
| Coste: empiezan en $30-100+/mes y escalan con volumen. Hoy gastamos ~$30/mes total en infra. |
| Lock-in: salir es trabajo grande. Postgres es portable a cualquier proveedor. |
| Latency: enviar eventos a SaaS añade 100-500ms vs INSERT local (<5ms). |
| Soberanía de datos: PII en proveedor externo = compliance complicada. |

Cuando lleguemos a 100k+ DAU consideramos. Por ahora, una tabla Postgres con buenos índices basta.

### Por qué retención solo 30 días

| Razón |
|---|
| El 95% de la utilidad operativa es <24h (alertas, debugging activo). |
| Investigación postmortem necesita hasta ~1 semana. 30d cubre con margen. |
| Beyond 30d: si necesitas histórico → archivar a S3 (cuenta AWS ya existe). |
| Coste: a 10k DAU + 50 eventos/día/user = 15M filas/mes. 30d × 15M = 450M filas en BD. Manejable con índices. Más allá → particionado por día. |

### Por qué fire-and-forget

| Razón |
|---|
| Observabilidad NUNCA debe romper requests reales. Es lo opuesto al business goal. |
| INSERT a observable_events tarda <5ms en caso normal, pero si BD lenta no queremos bloquear. |
| Si se pierde un evento por timeout: aceptable. La señal es estadística. |

### Buffer / sampling para client-side

Sin sampling y a 10k DAU:
- 50 navegaciones/día/user × 1 console.error por página rotas = 500k eventos/día
- Con sampling 10% en `console_error` y 100% en errores reales: ~50k eventos/día (manejable)

---

## 13. Historial

| Fecha | Cambio |
|-------|--------|
| 2026-05-25 | Manual creado. MVP funcional: tabla + writers Vercel/Fargate + 1 cron + espejo `validation_error_logs`. |
