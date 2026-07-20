# Runbook — Canaries (synthetic monitoring)

> **Qué son.** Sondas que ejecutan flujos reales contra **producción** cada pocos minutos (login, guardar respuesta, SELECT del pool, cache, endpoints, pings LLM) y **verifican el invariante en BD**, no solo un 200. Cazan roturas de madrugada que CI no ve (infra bajo carga, edge, saturación). Corren como crons NestJS en Fargate (`backend/src/canary-*`).
>
> **Por qué este runbook.** Tras el incidente 11/07 (un write-canary acumuló 10.737 filas hasta ahogarse) se montó un framework para que **no pueda repetirse por construcción**. Diseño: `docs/roadmap/canary-framework.md`. Memoria: `project_canary_framework_p1`.

## Piezas del framework (`backend/src/canary-shared/`)

- **`canary-probe.ts`** — contrato `CanaryProbe` (`name`, `eventBase`, `cadence`, `writesToProd`, `bounding`, `execute()`) + `boundingViolation()` (el invariante).
- **`canary-result.ts`** — `CanaryResult` único (`status: ok|skipped|failed|invalid`) + `severityForStatus`.
- **`canary-emit.ts`** — construye los eventos de observabilidad (`canary_<eventBase>_<status>` + `cron_run`). PURO y testeado: congela los strings exactos.
- **`canary-runner.service.ts`** — ejecuta un probe, cronometra, emite. El cron migrado queda en `runner.run(this.service)`.
- **`canary-registry.ts`** — `CANARY_REGISTRY`: catálogo único (name, eventBase, cadence, writesToProd, bounding, alertRule).
- **`canary-registry.spec.ts`** — el GUARDARRAÍL (ver abajo).
- **`canary-registry.boot.ts`** — `assertRegistryBounding()` al arrancar (fail-fast en prod).

## El invariante (por qué no se repite el 11/07)

**Un canary que ESCRIBE en tablas reales de prod DEBE declarar una cota.** `bounding ∈`:
- `read-only` — no escribe (por defecto).
- `unique-constraint` — el fixture colisiona en una PK fija → 1 fila para siempre (molde `canary-answer-save`, `SMOKE_SESSION_ID` fijo).
- `per-run-cleanup` — crea y BORRA en la misma pasada, huella cero (molde `canary-save-contract`).
- `cap-prune` — cuenta y purga a un baseline si supera un cap (molde `canary-stats-pipeline`, `SMOKE_FIXTURE_CAP=500` + `pruneFixtureIfNeeded()`).

Lo hace cumplir la **máquina, no la disciplina**: el guardarraíl de CI (`canary-registry.spec`) rompe el build si (a) un `writesToProd` no declara cota, (b) hay un directorio `canary-*` sin entrada en el registro (o al revés), o (c) un canary que emite `_failed` no tiene su regla de alerta. Además el boot-check aborta el arranque si la cota falta.

## Añadir un canary nuevo (checklist)

1. **Service** `implements CanaryProbe`: declara `name` (= slug del dir sin `canary-`), `eventBase` (⚠️ base del event-type; **no siempre == name** — `smoke-auth`→`auth`, `database-pool`→`db_pool`, `redis-upstash`→`redis`), `cadence`, `writesToProd`, `bounding`, y `execute()` que devuelve `CanaryResults.ok/skipped/failed(...)` (metadata específica en el `{ metadata: {...} }`).
2. **Cron**: `@Cron(cadence)` + registro de heartbeat + (opcional) jitter; el cuerpo = `await this.runner.run(this.service)`.
3. **Module**: importa `CanarySharedModule` (provee el runner). Regístralo en `app.module`.
4. **Registro**: añade la fila a `CANARY_REGISTRY` (name, eventBase, cadence, writesToProd, **bounding**, alertRule).
5. **Si `writesToProd`**: declara y aplica la cota (uno de los 3 moldes). Sin esto, el build/boot fallan.
6. **Alerta**: añade `RULE_CANARY_<X>_FAILED` en `backend/src/alerts/alert-rules.ts` (usa la fábrica `canaryFailedRule('canary_<eventBase>_failed', {...})`, pásale el eventType **literal**) y regístrala en `ALERT_RULES`. Pon `alertRule: true` en el registro.
7. **Test**: añade el caso a `canary-emit.spec` que CONGELA los strings emitidos (eventType/severity/endpoint/metadata) — así una futura refactorización no cambia la observabilidad en silencio.

Corre `npx jest src/canary-shared/ src/alerts/` + `npx tsc --noEmit`. Verde = coherente.

## Usuario sintético (no contamina analíticas)

El smoke user (`smoke@vence.es`, `registration_source='internal_canary'`) está marcado `user_profiles.is_synthetic=true` (fuente única). Excluido de: ranking (`refresh_ranking_cache`, streak), y **dificultad** (trigger `trg_skip_synthetic_first_attempt` en `question_first_attempts` descarta sus filas → nunca entra en `questions.global_difficulty`). Migración `20260720_synthetic_user_central.sql`. Al añadir una analítica cross-user nueva, exclúyelo por `is_synthetic`.

## Cuando salta una alerta `canary_*_failed`

`shouldFire` es tolerante a transitorios (`canaryFailureShouldFire`): un blip aislado (timeout/abort) NO dispara; ≥2 sostenidos o un error sustantivo (no-timeout), sí. Cada regla trae en el `body` las acciones concretas + el último `step`/`error`. El panel de salud (`/admin/salud-sistema`) y `observable_events WHERE event_type='canary_<x>_failed'` dan el detalle.

## Relacionados
- `docs/roadmap/canary-framework.md` — diseño + fases.
- `docs/runbooks/pusheo-revision-despliegue.md` §"Capas de seguridad" — el canary es la capa 4.
- `docs/runbooks/observability.md` — eventos y reglas de alerta.
