# Manual de Observabilidad — Vence

> **Documento vivo.** Plan para que Vence detecte problemas **antes que el usuario**, sin depender de feedback humano.
>
> **Última actualización:** 2026-05-25 (refactor incorporando aprendizajes de VicoHR + filosofía AWS-ready/agnóstica).

---

## 1. 🎯 Filosofía

> **Si un usuario nos reporta un bug que la observabilidad podía haber capturado, hemos fallado.**

La observabilidad bien hecha es el sistema nervioso de la app: te dice qué pasa, dónde, con qué frecuencia, y te despierta cuando algo se rompe. Sin ella, el equipo trabaja a ciegas y aprende de los problemas tarde (PR de cliente, churn silencioso, incidencias en horas punta).

### 5 Principios

1. **Todo error server-side llega a `observable_events`** con contexto suficiente para reproducirlo (`endpoint`, `userId`, `deploy_version`, `error_message`, `metadata`).
2. **Todo error client-side relevante llega también a `observable_events`** vía `/api/observability/ingest` (errors JS, promise rejections, fetches fallidos, Web Vitals degradados). Sentry queda como UI de deep-dive opcional, no como source of truth.
3. **Todo cambio en producción se verifica con observabilidad** ANTES de declarar OK. No esperar al primer ticket.
4. **Toda alarma debe ser accionable.** Si dispara y no haces nada → ruido, eliminarla.
5. **Cero blind spots.** Si una funcionalidad crítica (login, pago, test answer, exam validation) no tiene métrica de éxito, es deuda 🔴.

### Tres niveles de madurez

| Nivel | Qué cubre | Cuándo te enteras del bug |
|---|---|---|
| 1. Reactivo | Logs cuando un user reporta | Días después, vía email |
| 2. Pasivo | Logs persistentes consultables | Cuando alguien va a buscar |
| 3. **Activo** | Eventos + alertas + dashboards | Minutos. Antes del 2º usuario afectado |

Vence está hoy entre nivel 1 y 2. **El objetivo es nivel 3.**

### Principio rector arquitectural

> **AWS-native by default. Agnóstico by contract.**

- Las decisiones se toman pensando en "esto correrá en AWS en 6-12 meses" — porque escala mejor que Vercel/Supabase para nuestro patrón de carga (mediado por backend Fargate ya migrado en Bloque 3).
- **Pero el CÓDIGO de la app habla con interfaces estándar**, no con SDKs específicos de AWS. Cuando hagamos el swap completo a AWS, el código no se entera — solo cambia el adapter del sink. Ver §6 «Diseño Sink intercambiable» y §12 «Migración a AWS — qué cambia, qué NO».

---

## 1bis. 🧭 Dos tablas, dos propósitos (Issues vs Events)

> Sección añadida 2026-05-26 tras el audit de Bloque 4 Fase 1. Lo que parecía
> un «dual-write antipatrón» resultó ser **dos responsabilidades distintas**
> mal documentadas. Aclaración para futuras incorporaciones.

El sistema tiene **dos tablas observables** que NO son espejos redundantes
sino **responsabilidades complementarias**. La separación es deliberada y
sigue el patrón industria-estándar (Sentry: Issues vs Events; Datadog:
Monitors+Incidents vs Logs/Metrics; AWS: CloudWatch Alarms vs Logs).

| Tabla | Propósito | Volumen | Workflow humano |
|---|---|---|---|
| `validation_error_logs` | **Issues accionables** que requieren revisión humana | bajo (errores HTTP 4xx/5xx clasificados) | sí — columna `reviewed_at`, panel `/admin/fraudes`, mark-as-reviewed |
| `observable_events` | **Censo de eventos** para dashboards / SLOs / alertas | alto (request_completed, cron_run, tts_*, hydration, etc.) | no — solo lectura agregada |

### Regla operativa para developers

1. **Si necesitas que alguien revise el error manualmente** (errores HTTP del wrapper, OpenAI quota, oposición sin mapeo) → usa `logValidationError()` o `logValidationErrorAwait()` del módulo `lib/api/validation-error-log`. Va a `validation_error_logs` Y espeja automáticamente a `observable_events` vía `_insertLog`.

2. **Si solo necesitas registrar un evento operacional para dashboards/SLOs** (cron run, web vital, smoke test, request timing) → usa `emit()` / `emitFireAndForget()` del módulo `lib/observability/emit`. Va solo a `observable_events`.

3. **NUNCA hagas `db.insert(validationErrorLogs).values(...)` directo**. Bypassa el espejo y deja al evento fuera del censo. El audit del 2026-05-26 encontró 2 writers haciéndolo (corregidos en Bloque 4 Fase 1).

### Garantía de sincronización (Bloque 4 Fase 0 — 2026-05-26)

`_insertLog` ahora hace `await emit({...})` ANTES del `await db.insert(vle)`,
garantizando que cuando una entrada de `validation_error_logs` persiste,
su par en `observable_events` también persistió (o ambos fallan juntos,
nunca uno solo). Antes del fix había un race del 47% pérdida en el espejo.

### Arquitectura del sink (`lib/observability/sink.ts`)

El código de la app no escribe directo a Postgres — habla con la interfaz
`ObservableSink`. Hoy: `PostgresSink`. Mañana en AWS: `KinesisSink` con
fan-out via Firehose a S3 Parquet + OpenSearch + Aurora. El swap es UNA
línea en `getSink()` — cero cambios en callers.

---

## 2. 📊 Estado actual (2026-05-25)

### Lo que YA tenemos

#### Server-side (Vercel functions)

| Capacidad | Implementación | Ubicación |
|---|---|---|
| `withErrorLogging` wrapper auto-loguea ≥400 | Tabla `validation_error_logs` | `lib/api/withErrorLogging.ts` |
| Espejo a tabla unificada | Cada write a `validation_error_logs` también emite a `observable_events` (commit `7a4fa472`) | `lib/api/validation-error-log/queries.ts:_insertLog` |
| Emit directo | `emit()` / `emitFireAndForget()` | `lib/observability/emit.ts` |
| Severity normalization | `'warning'→'warn'`, `'fatal'→'critical'` | Helper interno en `emit.ts` |

#### Server-side (Backend NestJS/Fargate)

| Capacidad | Implementación | Ubicación |
|---|---|---|
| `ObservabilityService` con DI | INSERT directo vía Drizzle (mismo schema que frontend) | `backend/src/observability/observability.service.ts` |
| Logger NestJS contextual | `Logger` por servicio con prefix | Estándar NestJS |
| Health endpoint | `GET /health` devuelve `{status:'ok',ts,...}` | `backend/src/health/` |
| Cron `refresh-rankings` emite | 1 evento por run con `metadata.totalInserted`, `slowestMs` | `backend/src/refresh-rankings/refresh-rankings.cron.ts` |

#### Client-side (browser) — Opción E aplicada 2026-05-25

| Capacidad | Implementación | Estado |
|---|---|---|
| Sentry SDK + Session Replay | `sentry.client.config.ts` con replayIntegration (10% sessions + 100% on-error) | ✅ Live |
| Sentry `httpClientIntegration` | Auto-captura fetch 5xx | ✅ Live |
| Sentry `captureConsoleIntegration` | console.error/warn → Sentry | ✅ Live |
| Sentry `browserTracingIntegration` | Web Vitals (LCP/CLS/INP/FCP/TTFB) + page-load traces | ✅ Live |
| `beforeSend` hook | Cada evento Sentry se reenvía a `/api/observability/ingest` vía sendBeacon — espejo automático sin webhook | ✅ Live |
| Pre-hydration errors | `EarlyErrorsBridge` inline script en `<head>` + procesado en `client.ts` | ✅ Live |
| Intent tracking helpers | `trackIntent(id, desc)` / `confirmIntent(id)` en `lib/observability/client.ts` | ⚠️ Código listo, **falta adopción** en botones críticos |
| React Error Boundary | `Sentry.ErrorBoundary` nativo (importar de @sentry/nextjs) | ✅ Disponible (envolver secciones según necesite) |
| Endpoint smoke test | `GET /api/debug/observability-smoke?secret=...` valida los 3 canales | ✅ Live |

#### Infraestructura

| Capacidad | Implementación | Estado |
|---|---|---|
| Tabla `observable_events` + 4 índices | Migración `2026-05-25-observable-events.sql` aplicada | ✅ Live |
| Endpoint ingest HTTP | `/api/observability/ingest` (auth: shared secret) | ❌ FALTA |
| Cron poda 30d | — | ❌ FALTA |
| Dashboard admin `/admin/observability` | — | ❌ FALTA |
| Alertas activas (cron rules engine) | — | ❌ FALTA |
| SLOs declarados + medidos | — | ❌ FALTA |
| CloudWatch Logs Fargate | Auto vía ECS | ✅ Live (aislado) |
| Sentry alerts | — | ⚠️ No configurado |

### 📋 Matriz de cobertura por categorías de bug (post-Opción E)

| Categoría | Estado | Cómo se cubriría |
|---|:-:|---|
| Crashes server-side (Vercel) | ✅ | `withErrorLogging` + espejo a `observable_events` |
| Crashes server-side (Fargate) | ✅ | `AllExceptionsFilter` global captura ≥500 → `observable_events` |
| Latencia degradada (server) | ⚠️ | Eventos `cron_run` con `duration_ms`. Falta latencia agregada endpoint-by-endpoint |
| Latencia degradada (cliente) | ✅ | Sentry `browserTracingIntegration` mide LCP/CLS/INP/FCP/TTFB. Espejados a `observable_events` vía beforeSend |
| Errores HTTP visibles al user | ✅ | `withErrorLogging` ≥400 + Sentry `httpClientIntegration` 5xx client-side |
| Caída de servicio (uptime) | ⚠️ | Backend `/health`. Falta monitor externo + smoke E2E sintético (Gap 4) |
| Errores client-side JS uncaught | ✅ | Sentry SDK auto-captura + espejo `beforeSend` |
| Promise rejections sin catch | ✅ | Sentry SDK auto-captura |
| `console.error` / `console.warn` | ✅ | `Sentry.captureConsoleIntegration` |
| Hydration mismatch | ✅ | React 19 los lanza como errores → Sentry los pilla |
| API calls del cliente fallando (5xx) | ✅ | `Sentry.httpClientIntegration` |
| Pre-hydration errors | ✅ | `EarlyErrorsBridge` inline script → procesado por `client.ts` |
| React Error Boundary | ✅ | `Sentry.ErrorBoundary` (importar y envolver secciones) — disparados pasan por `beforeSend` |
| Cron no se ejecutó | ✅ | `cron_overdue` rule en `alerts-engine` (cada 5min vs `CRON_EXPECTED_INTERVAL_MIN`) |
| Cron falla repetido | ✅ | `cron_failure_burst` rule (≥3 fallos/hora) |
| Deploy backend fallido | ✅ | GHA step `if: failure()` → ingest endpoint + `deploy_failed` rule (≥1/10min) |
| GHA workflow failure (tests/lint/typecheck) | ✅ | Job `notify-failure` en `test.yml` → ingest endpoint |
| Spike 5xx (>20 en 5min) | ✅ | Rule `5xx_spike` → email Resend (cuando ECS rolloute con ADMIN_ALERTS_EMAIL) |
| Bug silencioso (click sin efecto) | ⚠️ | Código `trackIntent`/`confirmIntent` listo. **Pendiente adopción** en botones críticos |
| Datos corruptos (drift contadores) | ✅ | Tabla `stats_drift_log` + cron drift check |
| Performance degradación gradual | ⚠️ | Sentry Web Vitals captura. Falta dashboard agregación + SLO breach alert |
| Funnel roto (signup, payment) | ❌ | Sin instrumentar — futuro `trackIntent` adopción |
| Smoke E2E flujos críticos | ❌ | Gap 4 pendiente — cron Fargate cada 5min |
| Tracing distribuido (request → BD) | ❌ | Sentry SDK no instalado en backend NestJS — Gap 12 |
| SLOs declarados | ❌ | `docs/architecture/slos.yml` no existe — Gap 11 |
| 405 method-not-allowed framework-level | ❌ | Gap 13 — sin middleware Next.js, las páginas con método inválido responden fuera del wrapper |
| Vercel runtime kill (504 SIGTERM) | ❌ | Gap 14 — agujero arquitectural: lambda muere antes de poder loguear. Único fix: Vercel Log Drain → ingest |
| Shadow logs (`console.log` con `🔍`/`[shadow]`) | ❌ | Gap 15 — auth shadow no persiste, sin datos para diseñar cutover phase 3→5 |

**Cobertura real: ~88%** (post-audit 2026-05-26 con 3 gaps nuevos detectados). Cubrimos errores explícitos del código de app al 100%. Lo que falta para el 100% real: Gap 14 (Vercel runtime kill — único agujero arquitectural relevante), Gap 11 (SLOs formales), Gap 12 (tracing distribuido), Gap 4 (smoke E2E), Gaps 13/15 (cosméticos).

**Veredicto**: cubrimos bien los errores server-side explícitos. Lo que NO cubrimos son fallos que ocurren **fuera del control del código de app**: runtime kills de Vercel, métodos inválidos a páginas (framework-level), y logs que mueren con la lambda. **Gap 14 es prioridad alta** porque es la categoría que más nos hace «no enterarnos» de fallos reales en producción.

---

## 3. 🔴 Gaps detectados (con caso real)

Cada gap viene con un **caso real** que justifica la prioridad. No se mete un gap "por completitud" — solo cuando ha dolido.

### 🔴 Gap 1 — Errores client-side desaparecen en silencio

**Caso real (frecuente)**: usuarios reportan vía email que "no funciona el botón X" o "la página queda en blanco". Cuando vamos a buscar, no hay nada en `validation_error_logs` ni en CloudWatch. El error vivió y murió en la consola del navegador del usuario. **Tasa real de reporte de bugs: <5%**. El otro 95% se va a la competencia en silencio.

**Lo que tenemos**: Sentry SDK quizás funciona; no verificado.

**Lo que falta**: ver §5 «Client-side observability» — bloque completo de scripts (`window.onerror`, `unhandledrejection`, `console.error` patch, React Error Boundary, FetchInterceptor) que reportan a `/api/observability/ingest`.

**Esfuerzo**: 1-2h.

### 🔴 Gap 2 — Endpoint `/api/observability/ingest` no existe

**Caso real (presente)**: sin este endpoint, NO se puede:
- Enviar eventos desde el navegador del cliente
- Notificar fallos de GitHub Actions a la tabla
- Espejar webhooks de Sentry / Vercel deploy hooks
- Que GHA crons (Grupo B) emitan eventos

**Lo que tenemos**: writers desde Vercel y Fargate escriben directo a BD vía Drizzle (no necesitan ingest), pero el resto del ecosistema queda fuera.

**Lo que falta**: `app/api/observability/ingest/route.ts` con auth shared secret + Zod validation + batch INSERT.

**Esfuerzo**: 45 min.

### 🔴 Gap 3 — Interceptor global NestJS para errores backend

**Caso real (silencioso)**: cuando el backend NestJS lanza 500 en `/api/v2/test-config/articles`, hoy SOLO queda registro en CloudWatch Logs del Fargate. No llega a `observable_events`. El admin Vercel queries pierde visibilidad.

**Lo que tenemos**: cada cron emite manualmente con `obs.emitFireAndForget()`. Los controllers NO.

**Lo que falta**: `ExceptionFilter` global NestJS (`@Catch()`) que para todo error ≥500 emita evento `http_5xx` con contexto.

**Esfuerzo**: 30 min.

### 🟠 Gap 4 — Sin smoke E2E sintético automatizado

**Caso real**: validar el cutover de Bloque 3 KEYSTONE (answer-and-save al backend) requirió hacer curl manual con JWT artificial. Si rompiéramos algo el viernes a las 22h, nadie se enteraría hasta el primer login del lunes.

**Lo que tenemos**: smoke scripts en `/tmp/` ejecutados manualmente durante deploys.

**Lo que falta**:
- **Hoy (cron Fargate gratis)**: nuevo cron `@Cron('*/5 * * * *')` en backend que ejecute flujo crítico (registro de respuesta artificial con user de prueba dedicado) y emita `event_type='smoke_e2e'` con `severity:error` si falla.
- **Cuando migremos a AWS**: CloudWatch Synthetics canary (~$15/mes) con script Puppeteer haciendo login + flujo + logout. **No implementar hoy** para evitar lock-in prematuro.

**Esfuerzo**: 1-2h hoy (cron Fargate).

### 🟠 Gap 5 — Cron "no se ejecutó" no dispara alarma

**Caso real (potencial)**: tras los 13 cutovers de crons Fargate del 24/05, NADIE detectaría si `check-boe-changes` deja de ejecutarse a las 08:00 UTC. Solo el `cron drift` lo detectaría días después si los datos llegan stale.

**Lo que tenemos**: alarma "cron crasheó" via `severity:error` en eventos `cron_run`. NADA si simplemente no emite.

**Lo que falta**: regla de alertas cron-rules engine: `SELECT cron_name, MAX(ts) FROM observable_events WHERE event_type='cron_run' GROUP BY cron_name HAVING NOW() - MAX(ts) > expected_interval(cron_name) * 2`.

**Esfuerzo**: 1h (parte del Gap 8 «alertas activas»).

### 🟠 Gap 6 — GHA workflow failures sin notificación estructurada

**Caso real (24/05)**: el workflow `Tests` rojo desde el 23/05 nos mandaba 1 email por push. **17 emails ese día** = ruido que ahoga la señal. Tampoco los failures de `Deploy backend` paran nada — hoy he visto el workflow `in_progress` con timeout 30 min, sin alarma.

**Lo que tenemos**: emails sueltos de GitHub a tu inbox.

**Lo que falta**: step en cada workflow `if: failure() && always()` → curl POST a `/api/observability/ingest` con metadata del run (commit, conclusión, run URL). Después dashboard agrupa eventos por workflow + alarma "X failures en último Y min".

**Esfuerzo**: 30 min cuando exista el endpoint ingest (Gap 2 prerequisito).

### 🟠 Gap 7 — Verificar que Sentry funciona

**Caso real (sospecha)**: Sentry SDK configurado en `sentry.client.config.ts` desde hace meses. ¿Cuántos eventos hemos visto en Sentry esta semana? No los he revisado. Si Sentry no está disparando, es coste mensual sin valor.

**Lo que tenemos**: configuración Sentry en repo.

**Lo que falta**: trigger error de prueba (`throw new Error('sentry-smoke-test')` desde una ruta admin temporal), verificar que aparece en dashboard Sentry, anotar URL del proyecto en el manual.

**Esfuerzo**: 15 min.

### 🟡 Gap 8 — Cero alertas activas

**Caso real**: hoy si llegan 200 errores en 5 min, NADIE se entera hasta que un user manda email. El veredicto VERDE/ÁMBAR/ROJO del `/admin/salud-sistema` está sin auto-refresh push.

**Lo que tenemos**: dashboard `/admin/salud-sistema` que requiere abrirlo activamente.

**Lo que falta**: cron Fargate cada 5 min que ejecute reglas SQL sobre `observable_events`. Cada regla que dispara → email/Telegram al admin. Adapter para notificación (hoy email, mañana SNS cuando migremos AWS). Ver §9.

**Esfuerzo**: 1-2h.

### 🟡 Gap 9 — Dashboard `/admin/observability` no existe

**Caso real**: para responder "¿cómo va producción?" hoy hago 5 queries SQL distintas en CLI o abro `/admin/salud-sistema` que lee de 4 fuentes diferentes. Sin vista unificada queryable visualmente.

**Lo que tenemos**: queries SQL ad-hoc.

**Lo que falta**: página admin con filtros (source, severity, event_type, time range), sparkline de volumen, top error messages agrupados, stream auto-refresh. Ver §10 mockup.

**Esfuerzo**: 2-3h.

### 🟡 Gap 10 — Sin retención automática

**Caso real (futuro)**: a 10k DAU con ~50 eventos/día/user = 15M filas/mes. Sin poda, la tabla crece sin parar → queries lentas → costes Postgres innecesarios.

**Lo que tenemos**: nada (acabamos de crear la tabla).

**Lo que falta**: cron Fargate diario `@Cron('0 4 * * *')` que ejecute `DELETE FROM observable_events WHERE ts < NOW() - INTERVAL '30 days'`.

**Esfuerzo**: 15 min.

### 🟡 Gap 11 — Sin SLOs declarados

**Caso real**: cuando alguien pregunta "¿cuánto tarda answer-and-save?", la respuesta es "depende". Sin SLO no hay umbral. Sin umbral no hay error budget. Sin error budget las decisiones de "rollback o no" son políticas, no datos.

**Lo que tenemos**: 0 SLOs.

**Lo que falta**: 3-5 SLOs explícitos en `docs/architecture/slos.yml` (answer-and-save p95<500ms, medals avail 99.5%, etc.). Cron que mide vs SLO desde `observable_events` y emite `event_type='slo_breach'`. Quema error budget → freeze deploys automático cuando sobrepase. Ver §11.

**Esfuerzo**: 1h por SLO + 1h infra cron.

### 🟢 Gap 12 — Tracing distribuido (OpenTelemetry)

**Caso real (futuro)**: cuando un request falla en answer-and-save y se pasa por Vercel → ALB → Fargate → Postgres + Redis + Resend → background tasks, hoy NO podemos seguir el trace por las capas. Cada log es isla.

**Lo que tenemos**: nada.

**Lo que falta**: instrumentación OpenTelemetry en frontend + backend, propagación de `traceId` por headers, integración con Jaeger / Tempo / X-Ray. **Solo cuando los otros gaps estén cubiertos** — añadir tracing a un sistema sin alertas es overengineering.

**Esfuerzo**: 1-2 días.

### 🟠 Gap 13 — 405 method-not-allowed framework-level invisible

**Caso real (2026-05-25 20:48 UTC)**: `POST /unsubscribe 405` desde bot scanner `Google-Read-Aloud` (`Mozilla/5.0...Chrome/138... Mobile`). `/unsubscribe` es una página Next.js (`app/unsubscribe/page.tsx`), NO un route handler. Cuando Next.js recibe un método HTTP no soportado para una página, responde 405 directamente desde el framework **antes** de invocar nada — `withErrorLogging` solo envuelve handlers en `app/api/**`, así que jamás se ejecuta. El error no apareció en `validation_error_logs` ni en `observable_events`.

**Lo que tenemos**: nada — el 405 framework-level es totalmente invisible. Si un día un bot empieza a hammer `/login`, `/signup`, etc. con POST inválidos, no lo veríamos. Probabilidad de impacto real: baja (son bots scanner), pero gap real de cobertura.

**Lo que falta**: `middleware.ts` raíz que detecte rutas-página recibiendo métodos no aceptados (cualquier no-GET en páginas estáticas y dinámicas) y emita `observable_events` con `eventType: 'method_not_allowed'`, `source: 'vercel'`, `severity: 'info'` (es bot scanner típicamente, no error real).

**Esfuerzo**: 30 min.

### 🔴 Gap 14 — Vercel runtime kill (504 SIGTERM) invisible al código de app — ✅ ENDPOINT LIVE 2026-05-26

**Caso real (2026-05-25 20:31 UTC)**: `GET /api/v2/admin/dashboard 504 Vercel Runtime Timeout Error: Task timed out after 300 seconds`. La lambda alcanzó el límite `maxDuration` (300s default sin declarar) y Vercel la mató con SIGTERM. El handler **nunca retornó** — el wrapper `withErrorLogging` jamás vio `response.status`, no logueó nada. **El usuario vio un 504 sin que quedara rastro en nuestra observabilidad**.

Esta es la categoría de fallo más peligrosa porque:
- No es interceptable desde el código de la app (la lambda muere antes de poder hacer flush).
- Cubre TODO endpoint sin `maxDuration` corto declarado.
- Coincide con incidentes de cascada (cuando BD satura, varios endpoints superan el timeout).

**Mitigación parcial aplicada (2026-05-25)**: `app/api/v2/admin/dashboard/route.ts` recibió `maxDuration = 15` + `withDbTimeout(getDashboardData(), 12000)` — el handler ahora retorna 503 capturable a los 12s en vez de morir por SIGTERM a 300s. **Pero esto NO escala**: hay que aplicarlo manualmente endpoint por endpoint y siempre quedan blind spots (deploys nuevos, refactors que olvidan el timeout).

**Solución arquitectural — código DEPLOYED 2026-05-26**: endpoint dedicado `/api/observability/vercel-log-drain` (ver `app/api/observability/vercel-log-drain/route.ts`) con parser puro en `lib/observability/vercel-log-drain.ts`. Acepta el formato Vercel Log Drain (NDJSON o JSON array), filtra eventos relevantes (≥400 o level=error/warn), traduce a `ObservableEvent` con `eventType: 'runtime_kill' | 'http_5xx' | 'http_4xx' | 'deploy_failed' | 'vercel_log'` y persiste vía `emit()`. Tolerante a líneas malformadas y schema evolution.

**Activación operativa pendiente** (no automatizable desde código):

1. Ir a Vercel dashboard → Settings → Log Drains → **Add Log Drain**.
2. Tipo: **HTTPS**.
3. URL: `https://www.vence.es/api/observability/vercel-log-drain`.
4. Custom Headers:
   - `x-ingest-secret`: valor de `OBSERVABILITY_INGEST_SECRET` (el mismo del endpoint `/ingest`).
5. Sources: ✅ `lambda`, ✅ `edge`. Omitir `static` y `build` (ruido).
6. Format: **ndjson** (preferido) o `json`.
7. Project: solo `vence` (no aplicar a otros proyectos del workspace).
8. Save → Test → verificar que llega un evento de prueba a `observable_events` con `metadata.drain = true`.

Verificación post-activación:
```sql
SELECT created_at, event_type, http_status, endpoint, LEFT(error_message, 80) AS msg
FROM observable_events
WHERE source = 'vercel' AND metadata->>'drain' = 'true'
ORDER BY created_at DESC LIMIT 20;
```

Si tras 1h no aparecen eventos `metadata.drain=true`, revisar:
- Vercel UI → Log Drain → Recent Deliveries (Vercel muestra los retries y status codes).
- Header `x-ingest-secret` coincide con env var.
- URL pública del endpoint responde a curl POST manual.

**Esfuerzo restante**: 5 min (activación UI por operador con acceso al dashboard Vercel).

### 🟡 Gap 15 — Shadow logs (console.log) no se persisten en observable_events

**Caso real (2026-05-25 19:52-20:02 UTC)**: múltiples logs `🔍 [shadow] /api/profile GET sin Bearer token { requestedUserId: '...', ua: '...' }` visibles solo en Vercel logs. Es shadow logging de auth phase 3/7 (`app/api/profile/route.ts:decodeJwtPayloadUnsafe`) que detecta callers sin Bearer + posible IDOR antes de activar el enforcement.

El `console.log` muere con la lambda — no llega a `observable_events`, no es queryable, no agregable. Cuando llegue el momento de activar el enforcement (paso 5/7) **no tendremos datos históricos de baseline** para saber cuántos callers se romperían.

**Lo que falta**: auditar `console.log`/`console.warn` con prefijos `🔍`/`🔒`/`[shadow]` en `app/api/**` (~5-10 sitios) y migrarlos a `emitFireAndForget({ source:'vercel', severity:'info', eventType:'auth_shadow_no_bearer'|'auth_shadow_token_invalid'|..., endpoint, userId, metadata })`. Tras 1-2 semanas con datos en BD, podremos correr queries de cohort/UA distribution para diseñar el cutover del shadow → enforced con confianza.

**Esfuerzo**: 1-2h.

---

## 4. 🏗️ Diseño Sink intercambiable (agnóstico)

### Contrato

```typescript
// lib/observability/sink.ts (futuro)
export interface ObservableSink {
  emit(event: ObservableEvent): Promise<void>
  emitBatch(events: ObservableEvent[]): Promise<void>
}
```

El **shape `ObservableEvent`** se diseña compatible con [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/) — estándar industria, no AWS-specific. Eso garantiza que mañana podemos exportar a cualquier OTLP collector (Jaeger, Tempo, Honeycomb, NewRelic, X-Ray) sin reescribir la app.

### Implementaciones (intercambiables)

| Etapa | Sink primario | Sink secundario | Cambio en código de app |
|---|---|---|---|
| **Hoy** (Vercel + Supabase + Fargate) | `PostgresSink` (tabla `observable_events`) | — | — |
| **Migración a AWS RDS** | `PostgresSink` (mismo schema en RDS) | `CloudWatchLogsSink` (paralelo) | **0 cambios** — solo cambia `sink.ts:createSink()` |
| **Si dejamos AWS** | `PostgresSink` (cualquier Postgres) | sin sink secundario | 0 cambios |
| **Hipotético GCP/Azure** | `PostgresSink` (Cloud SQL / Azure DB) | OTLP collector estándar | 0 cambios |

### Por qué tabla Postgres como primario (no CloudWatch nativo)

| Razón |
|---|
| **Queries SQL flexibles**: agrupaciones, percentiles, joins con `users`/`tests`/etc. CloudWatch Logs Insights es más limitado. |
| **Portable**: cualquier Postgres (Supabase, RDS, Neon, self-hosted) sirve. CloudWatch ata a AWS. |
| **Una sola fuente**: dashboard admin lee de Postgres como cualquier otra query. CloudWatch sería 2ª UI separada. |
| **Coste**: Postgres ya está pagado (Supabase Pro). CloudWatch Logs ingest cuesta extra. |

### Cuándo añadir `CloudWatchLogsSink` secundario

Cuando migremos a AWS, mantener **AMBOS sinks en paralelo**:
- `PostgresSink` → queries SQL, dashboard `/admin/observability`, alertas custom
- `CloudWatchLogsSink` → integración con CloudWatch Alarms nativo, X-Ray tracing, Synthetics

Es "best of both worlds" sin perder portabilidad — el día que dejemos AWS, basta con quitar el sink secundario.

---

## 5. ⭐ Client-side observability (consolas de usuarios)

> **Sección crítica.** La mayoría de bugs visibles para el usuario NUNCA llegan al servidor. Sin captura activa, el bug se silencia.

### Qué queremos capturar

| Tipo | Ejemplo | Cómo capturarlo |
|---|---|---|
| **JS uncaught errors** | `TypeError: Cannot read 'x' of undefined` | `window.onerror` / `window.addEventListener('error')` |
| **Unhandled promise rejections** | `fetch().then()` sin `.catch()` | `window.addEventListener('unhandledrejection')` |
| **React component errors** | render() lanza | `<ErrorBoundary>` componente envolvente |
| **Hydration mismatches** | server HTML ≠ client | React 19 logs → console patch captura |
| **API call failures** | fetch a `/api/foo` devuelve 5xx | wrapper sobre `fetch()` que reporta |
| **Pre-hydration errors** | errores en scripts inline antes de React | `EarlyErrorsBridge` inline script |
| **Manual `console.error`** | código que loguea explícitamente | patch sobre `console.error` |
| **Web Vitals degradados** | LCP > 4s, CLS > 0.25 | `web-vitals` library + `sendBeacon` |
| **Intent tracking (bug silencioso)** | usuario clica botón, no pasa nada | `trackIntent('save-answer')` + `confirmIntent(...)` |
| **Third-party console noise** | warnings Recharts / Sentry SDK | `ConsoleNoiseFilter` inline script |

### Diseño completo (no implementado todavía — Gap 1)

**Archivo: `lib/observability/client.ts`** — instalación única en `app/layout.tsx`:

```typescript
'use client'

const SAMPLE_RATES = {
  js_uncaught: 1.0,           // 100% - bajo volumen, alta señal
  unhandled_rejection: 1.0,
  react_error_boundary: 1.0,
  console_error: 0.1,         // 10% - puede ser noisy
  fetch_failure: 1.0,
  hydration_mismatch: 1.0,
  intent_unfulfilled: 1.0,
  web_vital_degraded: 0.1,    // 10% - alto volumen, valor agregado
}

const BUFFER_FLUSH_MS = 5000
const buffer: ClientEvent[] = []

interface ClientEvent {
  ts: string
  severity: 'error' | 'warn'
  eventType: keyof typeof SAMPLE_RATES
  errorMessage: string
  metadata: {
    url: string         // location.pathname (NO querystring — puede tener PII)
    userAgent: string
    stack?: string      // truncado a 2000 chars
    componentStack?: string  // React Error Boundary
    httpStatus?: number      // fetch_failure
    intent?: string          // intent_unfulfilled
    vital?: { name: string; value: number; rating: 'good'|'needs-improvement'|'poor' }
  }
  userId?: string  // si hay user logueado
}

export function installClientObservability(userId?: string) {
  if (typeof window === 'undefined') return

  // 1) Uncaught errors globales
  window.addEventListener('error', (event) => {
    pushEvent('js_uncaught', 'error', event.message, {
      stack: event.error?.stack,
      filename: event.filename,
      line: event.lineno,
      col: event.colno,
    }, userId)
  })

  // 2) Promise rejections sin catch
  window.addEventListener('unhandledrejection', (event) => {
    pushEvent('unhandled_rejection', 'error', String(event.reason), {
      stack: (event.reason as Error)?.stack,
    }, userId)
  })

  // 3) console.error patch (sampling alto — puede ser noisy)
  const origConsoleError = console.error
  console.error = (...args: unknown[]) => {
    origConsoleError(...args)
    pushEvent('console_error', 'warn', args.map(String).join(' '), {}, userId)
  }

  // 4) Flush on unload (sendBeacon — supervive navigation)
  window.addEventListener('beforeunload', () => flush(true))

  // 5) Flush periódico
  setInterval(() => flush(false), BUFFER_FLUSH_MS)

  // 6) Web Vitals
  installWebVitalsReporter(userId)
}

function pushEvent(
  eventType: keyof typeof SAMPLE_RATES,
  severity: 'error' | 'warn',
  message: string,
  metadata: ClientEvent['metadata'],
  userId?: string,
) {
  if (Math.random() > SAMPLE_RATES[eventType]) return // sampling

  buffer.push({
    ts: new Date().toISOString(),
    severity,
    eventType,
    errorMessage: scrubPII(message).slice(0, 500),
    metadata: {
      url: location.pathname,
      userAgent: navigator.userAgent.slice(0, 200),
      ...metadata,
      stack: metadata.stack?.slice(0, 2000),
    },
    userId,
  })

  if (buffer.length >= 10) flush(false)
}

function flush(useBeacon: boolean) {
  if (buffer.length === 0) return
  const events = buffer.splice(0, buffer.length)
  const body = JSON.stringify({ events })

  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon('/api/observability/ingest', body)
  } else {
    fetch('/api/observability/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }
}

function scrubPII(s: string): string {
  return s
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/\b\d{9,}\b/g, '[number]') // DNI, phone
    .replace(/\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, '[jwt]')
}
```

### Componente FetchInterceptor

Patch `window.fetch` para reportar TODO fetch ≥400 automáticamente. Inspirado en VicoHR (`components/observability/FetchInterceptor.tsx`).

### Componente IntentTracking

`trackIntent('save-answer')` antes del click, `confirmIntent('save-answer', success)` tras la respuesta. Si el tracking dice "intent disparado pero NO confirmado en N segundos" → reporte automático. Detecta bugs silenciosos donde el click "no hace nada".

### React Error Boundary central

```tsx
// components/observability/ObservabilityBoundary.tsx
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

### EarlyErrorsBridge (errores pre-hidratación)

Inline script en `app/layout.tsx` antes de React. Captura errores antes de que React monte:

```html
<script dangerouslySetInnerHTML={{ __html: `
  (function() {
    window.__earlyErrors = [];
    window.addEventListener('error', function(e) {
      window.__earlyErrors.push({
        msg: String(e.message), stack: e.error && e.error.stack,
        ts: Date.now()
      });
    });
  })();
`}} />
```

Y en `installClientObservability` leer `window.__earlyErrors` al inicializar y emitirlos.

### ConsoleNoiseFilter (anti-ruido)

Silencia warnings third-party que no son nuestros bugs. Pattern matching sobre el primer arg del console.error:

```typescript
const NOISE_PATTERNS = [
  /Warning: validateDOMNesting/,
  /Recharts:/,
  /\[Sentry\]/,
  // añadir más según ruido real
]
```

Aplicado ANTES del patch que emite a `observable_events` para no ahogar la señal.

### Privacy & PII

**REGLA DE ORO:** los eventos client-side NUNCA deben incluir contenido sensible.

| Permitido | Prohibido |
|---|---|
| `location.pathname` (`/test/aleatorio`) | `location.search` (puede tener `?email=...`) |
| `userAgent` truncado | Cookies, tokens, headers |
| Error stack (código, no datos) | Contenido de inputs (`<input value="...">`) |
| `userId` (UUID anónimo) | Email, nombre, DNI |
| Mensaje truncado a 500 chars + `scrubPII()` | localStorage / sessionStorage completos |

`scrubPII()` aplica regex sobre emails, números largos (DNI/phone), JWT tokens.

### Sampling estratégico

A 10k DAU con `SAMPLE_RATES = 1.0` puede explotar a millones de eventos/día.

- **`js_uncaught` / `unhandled_rejection`**: 100% (bajo volumen, alta señal)
- **`console_error`**: 10% (alto volumen, ruido medio)
- **`fetch_failure`**: 100% (alta señal)
- **`web_vital_degraded`**: 10% (alto volumen, valor agregado estadístico)

**Rate-limit por error_message hash**: máx 100 eventos del mismo mensaje en 1h. Si un único bug explota tras deploy, no nos ahoga.

### Coexistencia con Sentry

Sentry sigue, pero deja de ser source of truth → pasa a ser **UI de deep-dive opcional**. La fuente única es `observable_events`. Si Sentry está caído o se cancela, no perdemos nada.

Cuando esté el endpoint ingest (Gap 2), considerar **webhook Sentry → ingest** que espeje eventos de Sentry a la tabla. Best of both worlds.

---

## 6. 📡 Cómo emitir desde código

### Frontend (Vercel functions)

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

Categorías estables. Si necesitas una nueva: añadirla aquí Y al manual antes de usarla.

| Categoría | Eventos válidos |
|---|---|
| HTTP | `http_4xx`, `http_5xx`, `http_timeout`, `http_aborted` |
| Crons | `cron_run` (metadata.status: success/failure), `cron_overdue` |
| Auth | `auth_failed`, `rate_limit_exceeded`, `device_limit_exceeded` |
| Cache | `cache_invalidation`, `cache_miss_storm`, `cache_hit_low` |
| Deploys | `deploy_started`, `deploy_completed`, `deploy_failed` |
| Cliente | `js_uncaught`, `unhandled_rejection`, `react_error_boundary`, `console_error`, `fetch_failure`, `hydration_mismatch`, `intent_unfulfilled`, `web_vital_degraded` |
| Negocio | `payment_failed`, `signup_completed`, `daily_limit_reached`, `slo_breach` |
| Sintético | `smoke_e2e` |

---

## 7. 📊 Cómo consultar eventos

### Queries básicas

```sql
-- Errores 5xx última hora
SELECT ts, endpoint, error_message, deploy_version
FROM observable_events
WHERE source = 'vercel' AND event_type = 'http_5xx' AND ts > NOW() - INTERVAL '1 hour'
ORDER BY ts DESC;

-- Eventos por minuto (sparkline última hora)
SELECT DATE_TRUNC('minute', ts) AS m, COUNT(*) AS n
FROM observable_events
WHERE ts > NOW() - INTERVAL '1 hour'
GROUP BY 1 ORDER BY 1;

-- Top endpoints con errores hoy
SELECT endpoint, COUNT(*) AS n
FROM observable_events
WHERE severity IN ('error', 'critical') AND ts >= CURRENT_DATE
GROUP BY endpoint ORDER BY n DESC LIMIT 10;

-- Latency p50/p95/p99 por endpoint últimas 24h
SELECT endpoint,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95,
       PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99,
       COUNT(*) AS n
FROM observable_events
WHERE ts > NOW() - INTERVAL '24 hours' AND duration_ms IS NOT NULL
GROUP BY endpoint ORDER BY p95 DESC LIMIT 20;

-- Crons que NO emitieron en última hora (cron_overdue check)
WITH expected AS (
  SELECT 'refresh-rankings' AS cron, 5 AS interval_min UNION ALL
  SELECT 'process-outbox', 5 UNION ALL
  SELECT 'check-boe-changes', 1440 -- 24h
  -- ...
)
SELECT e.cron, MAX(o.ts) AS last_run, e.interval_min,
       EXTRACT(EPOCH FROM (NOW() - MAX(o.ts)))/60 AS minutes_since_last
FROM expected e
LEFT JOIN observable_events o ON o.endpoint = e.cron AND o.event_type = 'cron_run'
GROUP BY e.cron, e.interval_min
HAVING EXTRACT(EPOCH FROM (NOW() - MAX(o.ts)))/60 > e.interval_min * 2;
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
  for (const x of r) console.log(x.ts.toISOString(), x.source, x.severity, x.event_type, x.endpoint, '|', (x.error_message||'').slice(0,80));
  await sql.end();
})();
"
```

---

## 8. 🔔 Alertas activas (futuro — Gap 8)

Cron Fargate `@Cron('*/5 * * * *')` que ejecuta reglas SQL sobre `observable_events`. Cada regla que dispara → `NotificationAdapter.send()`.

### Reglas iniciales

```typescript
const RULES: AlertRule[] = [
  {
    name: '5xx_spike',
    severity: 'critical',
    sql: `SELECT COUNT(*)::int AS n FROM observable_events
          WHERE event_type IN ('http_5xx', 'http_timeout')
            AND ts > NOW() - INTERVAL '5 minutes'`,
    threshold: (n: number) => n > 20,
    cooldownMin: 30,
  },
  {
    name: 'cron_overdue',
    severity: 'critical',
    // ver query "Crons que NO emitieron" en §7
    sql: `...`,
    cooldownMin: 60,
  },
  {
    name: 'deploy_failed',
    severity: 'critical',
    sql: `SELECT COUNT(*)::int AS n FROM observable_events
          WHERE event_type = 'deploy_failed' AND ts > NOW() - INTERVAL '10 minutes'`,
    threshold: (n: number) => n > 0,
    cooldownMin: 5,
  },
  {
    name: 'slo_breach',
    severity: 'warn',
    sql: `SELECT COUNT(*)::int AS n FROM observable_events
          WHERE event_type = 'slo_breach' AND ts > NOW() - INTERVAL '1 hour'`,
    threshold: (n: number) => n > 0,
    cooldownMin: 60,
  },
]
```

### NotificationAdapter (agnóstico)

```typescript
interface NotificationAdapter {
  send(alert: { rule: string; severity: string; message: string }): Promise<void>
}

// Hoy: EmailAdapter via Resend (ya configurado)
// Mañana en AWS: SNSAdapter via @aws-sdk/client-sns
// Hipotético: SlackAdapter, TelegramAdapter
```

El cron rules engine usa `NotificationAdapter` por interfaz — la implementación concreta se decide por env var o config. Swap futuro = 0 cambios en código de reglas.

---

## 9. 🖥️ Dashboard admin (futuro — Gap 9)

Path: `/admin/observability`.

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
├──────────────────────────────────────────────────────────────┤
│ SLO status                                                   │
│   /api/v2/answer-and-save p95: 423ms (target 500ms) ✅      │
│   /api/medals availability:  99.7% (target 99.5%) ✅        │
│   Error budget month:        67% spent — 9d left            │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. 🎯 SLOs (futuro — Gap 11)

Declarar explícitos en `docs/architecture/slos.yml`:

```yaml
endpoints:
  /api/v2/answer-and-save:
    availability: 99.9%
    latency_p95_ms: 500
    error_budget_window: 30d
    auto_freeze_at: 80  # % budget consumido → freeze deploys

  /api/v2/test-config/articles:
    availability: 99.5%
    latency_p95_ms: 200
    cache_hit_ratio_min: 0.85
```

Cron diario mide vs SLO desde `observable_events` y emite `event_type='slo_breach'`. Si error budget >80% consumido → `event_type='deploy_freeze_requested'`. El equipo decide si saltarlo o esperar.

**Beneficio:** quita la política del rollback. El dato decide.

---

## 11. 🚀 Migración a AWS — qué cambia, qué NO

### Lo que NO cambia (todo el código de app)

- `lib/observability/emit.ts` (frontend Vercel) — sigue llamando `emit(event)`
- `ObservabilityService.emit()` (backend NestJS) — idéntico
- `event_type` convention — estable
- Queries SQL sobre `observable_events` — siguen funcionando
- Dashboard `/admin/observability` — sigue leyendo de la misma tabla
- Reglas de alertas (cron rules engine) — siguen funcionando
- SLOs declarados — siguen midiendo igual

### Lo que SÍ cambia (solo capa de infraestructura)

| Componente | Hoy | Tras migración AWS |
|---|---|---|
| BD primaria | Supabase Postgres | RDS Postgres (mismo schema) |
| Sink primario | `PostgresSink` (Supabase) | `PostgresSink` (RDS) |
| Sink secundario | — | `CloudWatchLogsSink` (paralelo, para X-Ray + Synthetics) |
| Alertas | Email via Resend | SNS → email (más fiable) |
| Smoke E2E | Cron Fargate custom | CloudWatch Synthetics canary |
| Tracing | — (opcional) | X-Ray nativo |
| Logs Fargate | CloudWatch (aislado hoy) | CloudWatch (integrado con sink secundario) |
| Métricas custom | Tabla queriable | CloudWatch Metrics + tabla |

### Hoja de ruta de la migración

1. **Hoy → AWS-ready by contract**: implementar `ObservableSink` interfaz. Hoy solo `PostgresSink`. (1h)
2. **Cuando migremos BD**: cambiar `DATABASE_URL` a RDS. Sink no cambia.
3. **Cuando migremos compute (Vercel → ECS/Lambda)**: añadir `CloudWatchLogsSink` secundario. Código sigue llamando `emit()`.
4. **Activar Synthetics + X-Ray**: añadir como capas adicionales. El observable_events sigue siendo source of truth.

### Por qué AWS escala mejor

| Razón |
|---|
| **Backend dedicado proceso largo** — ya hecho con Fargate. Vercel lambdas son OK hasta ~5k DAU. |
| **Pool de conexiones BD** — Supabase Supavisor tiene limitaciones documentadas. RDS Proxy o pgBouncer en EC2 son superiores a 100k DAU. |
| **CDN global** — Vercel Edge es bueno. CloudFront con caching agresivo + S3 Origin escala más barato. |
| **Storage** — S3 ya es la solución obvia. Vercel Blob es wrapper sobre S3 con margen. |
| **Tracing/Monitoring nativos** — CloudWatch + X-Ray vs herramientas dispersas en Vercel + Supabase. |
| **Coste a escala** — Vercel Pro a 100k DAU = $$$ vs ECS Fargate spot + RDS reserved. |

### Por qué seguir agnóstico a pesar de AWS-native

| Razón |
|---|
| **Si AWS sube precios** o cambia política, podemos salir sin reescribir. |
| **Multi-cloud** (resiliencia) un día puede tener sentido. |
| **Talento**: ingenieros conocen estándares antes que SDKs específicos. |
| **Open source self-hosting**: si la empresa pivota, podemos correr en hardware propio. |

---

## 12. ✅ Definition of Done por gap

Cada gap se considera cerrado cuando los **5 puntos** se cumplen:

1. **Cambio mergeado en `main`.** Tests verde.
2. **Deploy aplicado a producción.**
3. **Smoke test del propio gap: deliberadamente provocar el problema** y verificar que la observabilidad lo detecta. Ej:
   - Gap 1: throw `throw new Error('smoke-client-side')` en una ruta admin temporal. Verificar que aparece en `observable_events` con `source='frontend'` en <1 min.
   - Gap 3: forzar 500 en un endpoint backend dummy. Verificar evento `http_5xx` en BD.
   - Gap 5: parar manualmente un cron en task ECS. Esperar 2× su intervalo. Verificar alarma dispara.
4. **Documentado en este manual** con la query/alarma/URL de dashboard correspondiente.
5. **Memoria de Claude actualizada** si requiere acción nueva post-deploy.

---

## 13. 🗺️ Roadmap priorizado

### Cobertura esperada por fase

| Categoría | Hoy | Tras Fase 1 | Tras Fase 2 | Tras Fase 4 | Tras migración AWS |
|---|:-:|:-:|:-:|:-:|:-:|
| Crashes server-side Vercel | ✅ | ✅ | ✅ | ✅ | ✅ |
| Crashes server-side Fargate | ⚠️ | ✅ interceptor | ✅ | ✅ | ✅ |
| Errores client-side JS | ❌ | ✅ | ✅ | ✅ | ✅ |
| API client fails | ❌ | ✅ FetchInterceptor | ✅ | ✅ | ✅ |
| Bug silencioso (intent) | ❌ | ⚠️ | ✅ | ✅ | ✅ |
| Cron no se ejecutó | ⚠️ | ⚠️ | ✅ alarma | ✅ | ✅ + Synthetics |
| Deploy roto silencioso | ❌ | ⚠️ | ✅ GHA hook | ✅ | ✅ + CloudFormation events |
| Regresión funcional post-deploy | ❌ | ❌ | ❌ | ✅ smoke E2E | ✅ Synthetics + X-Ray |
| SLO breach | ❌ | ❌ | ❌ | ✅ | ✅ |
| Tracing distribuido | ❌ | ❌ | ❌ | ❌ | ✅ X-Ray |

### Fases

**Fase 1 — Cerrar agujeros críticos (~4-5h, $0/mes)**
- [x] **Gap 2**: Endpoint `/api/observability/ingest` ✅ COMPLETO (2026-05-25)
- [x] **Gap 3**: Interceptor global NestJS errores ≥500 ✅ COMPLETO (2026-05-25)
- [ ] **Gap 1**: Client-side observability — `client.ts` + ObservabilityBoundary + EarlyErrorsBridge (1-2h)
- [ ] **Gap 7**: Verificar Sentry, anotar dashboard URL (15 min)
- [x] **Gap 10**: Cron poda 30d ✅ COMPLETO (2026-05-25)
- [ ] **Migración batch de los 12 crons Fargate restantes** a emitir (~1h con helper común)
- [x] **Gap 14**: Vercel Log Drain ✅ ENDPOINT LIVE (2026-05-26) — pendiente activación operativa en Vercel UI (5 min)

**Fase 2 — Alertas + dashboard (~3-4h, $0/mes)**
- [x] **Gap 8**: Cron rules engine con `NotificationAdapter` ✅ COMPLETO (backend/src/alerts/)
  - Reglas iniciales (2026-05-25): `5xx_spike`, `cron_overdue`, `deploy_failed`, `cron_failure_burst`.
  - Reglas Fase 1.6 (2026-05-26): `runtime_kill`, `tts_error_burst`, `hydration_mismatch_spike`, `workflow_failure_burst`.
- [ ] **Gap 9**: Dashboard `/admin/observability` (2-3h)
- [ ] **Gap 6**: GHA workflows con `if: failure()` → ingest (30 min) — emisor existe, falta wiring en cada workflow YAML
- [ ] **Gap 13**: middleware Next.js para 405 framework-level (30 min)
- [ ] **Gap 15**: migrar shadow `console.log` a `emit*` (1-2h)

**Fase 3 — Smoke E2E + más visibilidad (~2-3h, $0/mes hoy)**
- [ ] **Gap 4**: Cron Fargate smoke E2E cada 5 min (1-2h)
- [ ] **Gap 5**: Regla `cron_overdue` en rules engine (parte del Gap 8, ya activa al añadir la rule)
- [ ] Web Vitals reporter + FetchInterceptor del cliente

**Fase 4 — SLOs (~3-5h, $0/mes)**
- [ ] **Gap 11**: 3-5 SLOs declarados en `docs/architecture/slos.yml`
- [ ] Cron diario que mide y emite `slo_breach`
- [ ] Auto-freeze deploys cuando error budget >80%

**Fase 5 — Tracing (~1-2 días, $0/mes hoy)**
- [ ] **Gap 12**: Instrumentación OpenTelemetry (frontend + backend)
- [ ] Propagación de `traceId` en headers
- [ ] (Cuando migremos AWS) → X-Ray como visualizador

**Post-migración AWS**
- [ ] `CloudWatchLogsSink` secundario en paralelo
- [ ] CloudWatch Synthetics canary (reemplaza cron smoke E2E)
- [ ] CloudWatch Alarms nativas (paralelo a rules engine custom)
- [ ] X-Ray como visualizador de traces

### Coste mensual estimado

| Item | Hoy | Tras AWS |
|---|---|---|
| Postgres extra storage (observable_events 30d retención) | ~$0 (incluido Supabase Pro) | ~$0 (RDS marginal) |
| Endpoint ingest (Vercel function) | ~$0 (incluido Vercel) | ~$0 (Lambda) |
| Cron Fargate smoke E2E | $0 (incluido cluster actual) | $0 |
| Email alertas via Resend | $0 (free tier) | $0 (free tier) o SNS $0.50/1M |
| CloudWatch Synthetics canary | — | ~$15/mes |
| X-Ray | — | ~$5/mes |
| **Total observabilidad** | **~$0** | **~$20/mes** |

Pago por nivel pro: $20/mes total. Aceptable.

---

## 13bis. 🔊 Taxonomía TTS (Bloque 4 — 2026-05-25)

Eventos del lector de temario (Web Speech robusto). Catálogo completo definido en `lib/tts/telemetry.ts`. Todos van a `observable_events.source='frontend'` vía `/api/observability/ingest`.

### Catálogo de eventos

| eventType | severity | volumen | sample rate | metadata clave |
|---|---|---|---|---|
| `tts_session_start` | info | bajo (1/play) | 100% | `sessionId`, `lawName`, `chunksTotal`, `textLen`, `voiceURI`, `voiceName`, `rate`, `browser`, `isMobile` |
| `tts_session_end` | info / warn(*) | bajo | 100% | `sessionId`, `endReason: natural\|user_stop\|unmount\|error\|chain_advance`, `durationMs`, `chunksCompleted`, `chunksTotal`, `chunksSkipped` |
| `tts_chunk_skip` | warn | medio | 100% | `sessionId`, `chunkIdx`, `chunksTotal`, `reason: dead\|zombie`, `retriesAttempted` |
| `tts_watchdog_retry` | debug | alto | 10% | `sessionId`, `chunkIdx`, `retryNum`, `reason` |
| `tts_no_voices` | warn | bajo | 100% | `totalVoices`, `spanishVoices`, `voicesLoaded` |
| `tts_voices_load_timeout` | warn | muy bajo | 100% | `waitedMs` |
| `tts_chain_advance` | info | medio | 100% | `fromSessionId`, `fromLaw`, `toLaw` |
| `tts_error` | error | bajo | 100% | `sessionId`, `atChunkIdx`, `errorType`, `message` |
| `tts_unsupported` | warn | muy bajo | 100% | (solo browser/isMobile en enriched meta) |
| `tts_user_action` | debug | medio | 20% | `sessionId`, `action: pause\|resume\|stop\|rate_change\|voice_change`, `atChunkIdx`, `fromValue`, `toValue` |

(*) severity es `warn` solo cuando `endReason='error'`.

### Correlación de eventos por sesión

Una "sesión TTS" = un `play()`. Generada con `crypto.randomUUID()`. Lifecycle:

```
tts_session_start
  ↓ (chunks reproducen)
tts_watchdog_retry × N (muestreado 10%)
  ↓
tts_chunk_skip × M (si pasa retries)
  ↓
tts_session_end (endReason=natural)
  ↓
tts_chain_advance (si modo=topic) → arranca nueva sessionId
```

Toda la query se hace JOIN por `metadata->>'sessionId'`.

### Queries de funnel

**Tasa de finalización natural (SLO candidate ≥95%):**

```sql
WITH sessions AS (
  SELECT
    metadata->>'sessionId' AS session_id,
    MAX(CASE WHEN event_type='tts_session_end' THEN metadata->>'endReason' END) AS end_reason
  FROM observable_events
  WHERE event_type IN ('tts_session_start','tts_session_end')
    AND ts > NOW() - INTERVAL '24 hours'
  GROUP BY 1
  HAVING MAX(CASE WHEN event_type='tts_session_start' THEN 1 END) = 1
)
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN end_reason='natural' THEN 1 ELSE 0 END) AS naturales,
  ROUND(100.0 * SUM(CASE WHEN end_reason='natural' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS pct_natural,
  COUNT(*) FILTER (WHERE end_reason IS NULL) AS abandonadas_sin_end
FROM sessions;
```

**Tasa de chunk_skip por browser/device:**

```sql
SELECT
  metadata->>'browser' AS browser,
  metadata->>'isMobile' AS is_mobile,
  COUNT(*) FILTER (WHERE event_type='tts_chunk_skip') AS skips,
  COUNT(DISTINCT metadata->>'sessionId') FILTER (WHERE event_type='tts_session_start') AS sessions,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE event_type='tts_chunk_skip')
    / NULLIF(COUNT(DISTINCT metadata->>'sessionId') FILTER (WHERE event_type='tts_session_start'),0),
    2
  ) AS skips_per_100_sessions
FROM observable_events
WHERE event_type IN ('tts_session_start','tts_chunk_skip')
  AND ts > NOW() - INTERVAL '7 days'
GROUP BY 1, 2
ORDER BY skips_per_100_sessions DESC NULLS LAST;
```

**Sesiones donde el watchdog tuvo que skip ≥2 chunks (señal fuerte de problema en device):**

```sql
SELECT
  metadata->>'sessionId' AS session_id,
  metadata->>'browser' AS browser,
  COUNT(*) AS chunks_skipped
FROM observable_events
WHERE event_type='tts_chunk_skip'
  AND ts > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2
HAVING COUNT(*) >= 2
ORDER BY chunks_skipped DESC
LIMIT 50;
```

**Distribución de duración de sesiones natural-ended (percentiles):**

```sql
SELECT
  metadata->>'browser' AS browser,
  PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY duration_ms) AS p50_ms,
  PERCENTILE_DISC(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_ms,
  PERCENTILE_DISC(0.99) WITHIN GROUP (ORDER BY duration_ms) AS p99_ms,
  COUNT(*) AS n
FROM observable_events
WHERE event_type='tts_session_end'
  AND metadata->>'endReason' = 'natural'
  AND ts > NOW() - INTERVAL '7 days'
GROUP BY 1
ORDER BY n DESC;
```

### SLO candidato

| SLO | Umbral | Cuándo dispara |
|---|---|---|
| % sesiones que terminan natural | ≥ 95% | Si baja → bug en Chrome/dispositivo |
| chunk_skip por sesión | ≤ 0.5 promedio (≈ 1 cada 2 sesiones) | Si sube → watchdog peleando bug Chrome |
| `tts_no_voices` por mes | < 0.5% de visitas únicas a temario | Si sube → cohort de devices sin voces |

### Alertas (cuando exista el rules engine — Gap 8)

```yaml
- name: tts_unhealthy_natural_end_rate
  query: |
    SELECT 100.0 * COUNT(*) FILTER (WHERE metadata->>'endReason'='natural')
      / NULLIF(COUNT(*) FILTER (WHERE event_type='tts_session_start'),0)
    FROM observable_events
    WHERE event_type IN ('tts_session_start','tts_session_end')
      AND ts > NOW() - INTERVAL '1 hour'
  threshold: '< 80'
  severity: warn

- name: tts_chunk_skip_burst
  query: SELECT COUNT(*) FROM observable_events WHERE event_type='tts_chunk_skip' AND ts > NOW() - INTERVAL '15 minutes'
  threshold: '> 20'
  severity: warn
```

---

## 14. 📚 Notas técnicas

### Por qué tabla Postgres en vez de SaaS dedicado (Datadog/NewRelic)

| Razón |
|---|
| **Coste**: SaaS dedicados empiezan en $30-100+/mes y escalan con volumen. Postgres ya pagado. |
| **Lock-in**: salir de Datadog es trabajo grande. Postgres es portable. |
| **Latencia**: emitir a SaaS añade 100-500ms vs INSERT local (<5ms). |
| **Soberanía de datos**: PII en proveedor externo = compliance complicada. |
| **Cuando llegar a 100k+ DAU**: reconsiderar. Hoy YAGNI. |

### Por qué retención solo 30 días

- 95% de la utilidad operativa es <24h (alertas, debugging activo).
- Investigación postmortem necesita hasta ~1 semana. 30d cubre con margen.
- Beyond 30d: archivar a S3 (cuenta AWS ya existe) si compliance/análisis lo requiere.
- A 10k DAU × 50 eventos/día/user = 15M filas/mes. 30d × 15M = 450M filas. Manejable con índices BTREE.

### Por qué fire-and-forget

- Observabilidad NUNCA debe romper requests reales. Es lo opuesto al business goal.
- INSERT tarda <5ms en caso normal, pero si BD lenta no queremos bloquear.
- Pérdida ocasional de evento por timeout: aceptable. La señal es estadística.

### ⚠️ FOOTGUN: fire-and-forget SIN timeout = slots pool zombie

**Incidente real (2026-05-27 17:00–19:50 UTC, 1995 errores 503)**:

`backend/src/observability/observability.service.ts` hace `await this.db.execute(sql\`INSERT INTO observable_events...\`)` SIN timeout. Si Supavisor/Postgres queda esperando en `wait=Client/ClientRead` (TCP roundtrip degradado), el INSERT **nunca completa ni rechaza** → la promise queda pending para siempre → el slot del pool postgres-js (max 7-8 conexiones) queda **zombie indefinido**.

Cuando varios slots se acumulan así:
1. Pool se llena.
2. Queries reales (DailyLimit, Medals, antifraud) no encuentran slot.
3. Antifraud quick-fail (`ANTIFRAUD_TIMEOUT_MS`) → `serviceSaturatedResponse()` → 503.
4. **Cascada**: cada request real falla en `/api/v2/answer-and-save` con 503.
5. Diagnóstico engañoso: el canary `SELECT 1` responde OK (slots libres puntuales) pero queries reales fallan masivamente.

**Fingerprint del incidente en `pg_stat_activity`**:
```sql
SELECT pid, application_name, state,
       NOW() - query_start AS duration,
       wait_event_type, wait_event, LEFT(query, 100) AS q
FROM pg_stat_activity
WHERE application_name = 'Supavisor'
  AND state != 'idle'
  AND NOW() - query_start > INTERVAL '30 seconds';
-- 1+ filas con wait=Client/ClientRead y INSERT INTO observable_events → footgun activo.
```

**Mitigación reversible** (durante incidente):
1. `SELECT pg_terminate_backend(<pid>)` para liberar slots colgados.
2. Si reaparecen → `aws ecs update-service --force-new-deployment` para reset completo del pool postgres-js.

**FIX DEFINITIVO PENDIENTE**: añadir timeout al `db.execute()` en `emit()`. Opciones:
1. `Promise.race([execute, setTimeout(reject, 5000)])` — manual.
2. `AbortSignal.timeout(5000)` pasado como option a Drizzle execute (verificar soporte).
3. Configurar `idle_in_transaction_session_timeout` o `statement_timeout` a nivel de sesión postgres-js para el cliente del backend.

Si el timeout salta, el catch existente loguea el warn y suelta el slot. Pérdida del evento = aceptable. Slot zombie = NO aceptable.

**Lección aplicable**: TODA llamada a Drizzle/Postgres en path fire-and-forget DEBE tener timeout. El patrón "catch all" no es suficiente — un await que nunca resuelve nunca llega al catch.

### Por qué buffer + sendBeacon en client

- Sin buffer: 1 fetch HTTP por evento → cliente se ahoga.
- Sin `sendBeacon` para unload: eventos en buffer se pierden al cerrar pestaña.
- `keepalive: true` en fetch: equivalente a sendBeacon en navegadores modernos.

---

## 15. 📋 Historial

| Fecha | Cambio |
|-------|--------|
| 2026-05-25 | Manual creado (MVP funcional: tabla + writers Vercel/Fargate + 1 cron + espejo `validation_error_logs`). |
| 2026-05-25 (tarde) | **Refactor con filosofía "AWS-ready by default, agnóstico by contract"**. Incorporados aprendizajes de VicoHR: frase martillo, 5 principios numerados, matriz cobertura por categorías, gaps con CASO REAL, diseño Sink intercambiable, smoke E2E como cron Fargate (sin lock-in hoy, plan AWS Synthetics futuro), Definition of Done por gap, sección «Migración a AWS — qué cambia, qué NO», coste mensual estimado. |
| 2026-05-27 (noche) | **Incidente 1995 errores 503 en /api/v2/answer-and-save** (17:00–19:50 UTC). Causa raíz: `emitFireAndForget()` SIN timeout permitió que INSERTs colgados en `wait=Client/ClientRead` vía Supavisor acumularan slots zombie en el pool postgres-js (max 7-8). Pool saturado → antifraud quick-fail → 503 cascada. Mitigación: `pg_terminate_backend()` + `force-new-deployment`. Footgun + fingerprint pg_stat_activity + fix pendiente documentado en §"⚠️ FOOTGUN" arriba. |
| 2026-05-25 (noche) | **Refactor TTS robusto + taxonomía completa**. Web Speech reescrito con state machine (`lib/tts/stateMachine.ts`), motor encapsulado (`lib/tts/engine.ts`), hook React (`lib/tts/useTTS.ts`). ArticleTTS pasa de 599 líneas a 265 (UI pura). Fixes: (a) bucle al final de ley — NATURAL_END es idempotente vía SM; (b) resume desde la posición guardada tras pause o stop, no desde 0. Taxonomía de 10 eventTypes en §13bis con queries de funnel + SLOs candidatos. 104 tests TTS pasando. |
