# Incidente — answer-save 503 + crash-loop backend (2026-06-01)

> **Estado**: 🟢 Mitigado en código (handler global de proceso). Causa raíz de infra (SPOF de BD) sigue abierta como Fase D.
> **Severidad**: P1 — `/api/v2/answer-and-save` caído ~4 min para usuarios reales.
> **Ventana**: 2026-06-01 ~11:15–11:22 UTC (recuperación automática).

---

## Resumen ejecutivo

Un **blip de ~7 min de la primaria de Supabase** (FATAL `XX000 — DbHandler exited`) tumbó simultáneamente al frontend (db-ready 503) y al backend (crons parados). El daño se **amplificó** porque una *unhandled promise rejection* en el backend, ante el error de BD, **mató el proceso NestJS** (exit 1) → ECS entró en **crash-loop de 5 tasks en 5 min**. Resultado: 351 errores 503/504 en `/api/v2/answer-and-save` + cascada en medals, profile, test-config.

Un blip de BD de ~30s se convirtió en una caída de 7 min por falta de una red de seguridad a nivel de proceso.

## Timeline (UTC)

- **11:15:07** — outbox-processor (cada 5s) emite su último tick; el backend deja de poder operar contra BD.
- **11:18–11:20** — pico de 503: answer-save (quick-fail 30-70ms), db-ready 503 ×105 (frontend pierde readiness de BD), un 504 de 10s. pool-capacity-sampler y canary-answer-save se saltan sus ticks de las 11:20 (backend saturado/caído).
- **11:17:54–11:22:47** — ECS recicla 5 tasks del backend (`Essential container exited`, exitCode 1) en crash-loop.
- **11:22:15** — outbox-processor vuelve (gap de 428s). Steady state ECS 11:22:47.
- **11:22+** — recuperación total. 0 errores answer-save desde entonces.

## Causa raíz

1. **Infra (detonante)**: la **primaria de Supabase es única, sin failover** (`db.{ref}.supabase.co`, Pro, max_connections=90). Tanto el frontend (vía nuestro PgBouncer) como el backend (vía Supavisor) desembocan ahí. Un blip de la primaria → fallo cluster-wide. Prueba: read replica + cache stale-if-error sobrevivieron (theme-stats, exam/pending, interactions = 0 errores); cayó solo lo que toca la primaria/escritura.
2. **Código (amplificador)**: el backend **no tenía handler global de `unhandledRejection`**. Ante el error de BD, una promesa rechazó sin `.catch` y Node (default `--unhandled-rejections=throw`) **mató el proceso**. Cada task nueva volvía a chocar con la misma BD caída → crash-loop hasta que la BD se recuperó.

**Nota de honestidad técnica**: la promesa exacta que filtró NO se reprodujo desde el working tree actual (que tiene guards fail-open en `getDynamicLimit`/`getDailyLimitStatus`). El backend desplegado (task-def:19) era de un commit anterior, probablemente sin esos guards. Se descartó empíricamente que el footgun fuera `Promise.race` en `withTimeout` (race sí adjunta reactor a la promesa perdedora → no filtra). El fix correcto es por tanto independiente de la fuente concreta: el handler global.

## Por qué la "redundancia" no protegió

| Capa | ¿Redundante? | ¿Protegió hoy? |
|---|---|---|
| Pooler PgBouncer | ✅ HA (2 VMs + NLB, failover 37s) | N/A — el fallo fue por debajo del pooler |
| Frontend ECS | ✅ desired=2 | Parcial (db-ready 503 igual) |
| Lecturas | ✅ read replica + cache | ✅ sobrevivieron |
| **Primaria de BD** | ❌ **instancia única** | ❌ **SPOF — causa raíz** |
| **Backend ECS** | ❌ desired=1 | ❌ crash-loop sin red de seguridad |
| Backend → pooler | ❌ aún en Supavisor, no en nuestro PgBouncer | ❌ expuesto a blips de Supavisor |

## Fixes aplicados (este commit)

- **`backend/src/main.ts`** — `installProcessSafetyNet()`: `process.on('unhandledRejection')` (log + Sentry, **NO exit** → degrada a request fallida, proceso sigue) + `process.on('uncaughtException')` (log + Sentry + exit 1 limpio con flush). **Esto solo habría reducido el incidente de 7 min a ~30s.**
- **`backend/src/common/with-timeout.ts`** — `.catch` defensivo no-op sobre la promesa perdedora de la carrera (defensa-en-profundidad para casos límite; NO era la causa probada).
- **`backend/src/common/with-timeout.spec.ts`** — 5 tests, incluido el candado "rejection tardía de la perdedora no queda unhandled".

## Decisión de observabilidad — Sentry fuera del backend (2026-06-01)

Durante el diagnóstico, el backend logueaba `Invalid Sentry Dsn` al arrancar: **Sentry no estaba capturando nada en el servidor**, y aun así diagnosticamos el incidente entero desde CloudWatch + `observable_events` + SQL. Eso confirma que en el servidor Sentry era **redundante** con nuestra fuente de verdad.

**Acción tomada**: eliminado el SDK de Sentry del backend (borrado `src/instrument.ts`, `SentryModule.forRoot()` de `app.module.ts`, captura en `all-exceptions.filter.ts`, e import en `main.ts`). El filtro global sigue emitiendo `http_5xx` a `observable_events` + log a CloudWatch — **cero pérdida de fuente de verdad**. El handler de proceso (`main.ts`) loguea a stdout/CloudWatch (sink robusto de último recurso: no depende de la BD, que puede ser justo lo caído).

**Dirección** (filosofía del manual: *AWS-native by default, agnóstico by contract*): fuente de verdad nuestra (`observable_events`) + contrato estándar (OpenTelemetry) + sink intercambiable. Sentry, si se mantiene, solo en cliente (Session Replay) y como exporter opcional, nunca como source of truth.

**Follow-up trivial**: podar `@sentry/nestjs` + `@sentry/profiling-node` de `backend/package.json` (ya no se importan; se dejó para no tocar el lockfile en sesión multi-agente).

## Pendiente (priorizado)

1. **Backend ECS desired=2 con leader-election en crons** (barato; pero NO habría salvado este incidente — las 2 tasks habrían crasheado igual; el handler global importa más para este modo de fallo). El leader-election es requisito previo (sin él, doble disparo de @Cron).
2. **Migrar el backend a nuestro PgBouncer self-hosted** (`USE_SELF_HOSTED_POOLER` también en el backend) — hoy sigue en Supavisor, expuesto a sus blips. Hueco del proyecto pool-segregation, que solo cubrió el frontend.
3. **Fase D — RDS Multi-AZ / Aurora** ([`ARCHITECTURE_ROADMAP.md`](../ARCHITECTURE_ROADMAP.md)): el fix estructural del SPOF de la primaria. Con failover automático (30-120s), un blip futuro no sería un apagón. Es el grande y planificado.
4. **Reintento en cliente para answer-save** — que un blip breve devuelva latencia (reintento) en vez de 503 al usuario.
5. **Endpoint `/api/observability/ingest`** (Gap 2 del manual de observabilidad) — gateway vendor-neutral; desbloquea capturar client-side sin Sentry. Keystone del resto.
6. **OpenTelemetry** (frontend + backend → OTel Collector → backend AWS-native) — tracing distribuido request→BD. El incidente de hoy habría sido un trace de un clic. Solo después del paso 5 y de tener alertas (ya las hay) — tracing sin alertas es overengineering (regla del manual).

## Cómo se diagnosticó (para la próxima)

- `aws ecs describe-services --profile vence --region eu-west-2 --cluster vence-backend` → eventos de reciclaje de tasks.
- `aws ecs describe-tasks ... --query 'tasks[].{stopped:stoppedReason,containers:containers[].exitCode}'` → exitCode 1 = crash de app.
- `aws logs get-log-events --log-group /ecs/vence-backend --log-stream backend/backend/<taskId>` → el stack con `DbHandler exited` FATAL XX000.
- En BD: gap de `cron_run` de outbox-processor (prueba del backend caído) + `db-ready` 503 del frontend (prueba de que el fallo es de la capa BD, no solo del backend).
