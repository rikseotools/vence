# Roadmap — Framework profesional de canaries (synthetic monitoring)

> **Objetivo:** que TODOS los canaries sigan un mismo procedimiento robusto para que **no vuelva a pasar** un incidente como el del 11/07 (un canary acumulando datos sin límite hasta ahogarse). Origen: `project_coordinacion_sesiones_paralelas_deploy` (sesión 11/07) + este documento.

## El incidente que lo motiva (11/07/2026)

`canary-stats-pipeline` (y `canary-answer-save`, que comparte fixture) hace `POST /api/v2/answer-and-save` **insertando 1 fila real en `test_questions`** por pasada (~288/día) para el smoke user (`smoke@vence.es`) + una `SMOKE_QUESTION` fija, y **NUNCA limpia** (el comentario lo asumía "insignificante, filtrable"). A los ~45 días: **10.737 filas** para un solo `(user_id, question_id)`. Su propia drift-query `SELECT COUNT(*), MAX(question_order) …` hace un **Bitmap Heap Scan de ~9.700 bloques** (question_order no está en el índice) → **13,6 s** → `statement_timeout` → el cron falla repetido → `RULE_CRON_FAILURE_BURST` → emails `[Vence ERROR] cron(s) con fallos repetidos`. **Se autoenvenena y se acelera solo.** No era contención de RDS (9% de conexiones) ni carga real.

**Dos defectos de raíz:**
1. **Sin ciclo de vida del fixture:** un canary que MUTA tablas reales de prod debe ser idempotente / self-cleaning / acotado. Éste acumulaba sin fin.
2. **Contaminación de analíticas:** el smoke user lleva ~12.560 "respuestas" reales (todas correctas a un art. de la CE) que **no están excluidas de rankings/dificultad/stats** (no hay exclusión central; `isSyntheticRequest` es solo a nivel de request, no de datos).

## Qué es ya profesional (conservar)
- Synthetic monitoring **end-to-end contra prod real** (no mocks): `canary-answer-save`, `canary-stats-pipeline`, `canary-theme-stats`, `canary-smoke-auth`, `canary-questions-gate`, `canary-db-pool`, `canary-redis`, `canary-topic-data`, `canary-webhook`.
- Una **regla de alerta por canary** (`RULE_CANARY_*_FAILED`) con cooldown + tolerancia a transitorios (`TRANSIENT_CANARY_ERROR`, n≥2).
- Firma de token compartida (`canary-shared/canary-token.ts`), header `x-vence-canary` (exime de gate + degrada observabilidad), skip-si-fixture-no-disponible (`fixtureOk`).

## Diseño objetivo

### 1. Clase base `CanaryProbe` (contrato único)
Todo canary la extiende y hereda/declara:
- **`writesToProd: boolean`** — si escribe en tablas reales.
- **`pruneFixture()` / cota** — OBLIGATORIO cuando `writesToProd`. El framework **fuerza** que el fixture esté acotado; imposible acumular sin límite por construcción.
- **Resultado uniforme** (`ok | skipped | failed` + `durationMs` + `step`) → alimenta una familia de alertas homogénea.
- **Observabilidad estándar** (`x-vence-canary`, emit `canary_run`/`canary_<name>_failed`).
- **Skip estándar** si faltan credenciales / fixture no disponible.

### 2. Aislamiento del dato sintético (dos capas)
- **Fixture acotado** (cap + prune) → nunca crece.
- **Exclusión central del usuario sintético de TODA analítica:** `SYNTHETIC_USER_IDS` (o flag `user_profiles.is_synthetic`) aplicado en rankings, stats, cálculo de dificultad, `reward_earnings`, leaderboards. Invisible por contrato — no "es filtrable" a mano.

### 3. Registro único `CANARY_REGISTRY`
Fuente de verdad de qué canaries existen → un patrón de alerta, un dashboard, un sitio para verlos.

### 4. Procedimiento auto-verificado (para que no reincida)
- **Guardarraíl en CI**: test que verifica que (a) todo canary extiende la base, (b) todo write-canary declara prune/cota, (c) el usuario sintético está excluido de las queries de analítica. Un canary que escribe sin acotar → **rompe el build**.
- **Runbook** `docs/runbooks/canaries.md`: cómo añadir uno, reglas de fixture.

## Fases

- **P0 — Fuego (HECHO, 11/07):** purga de las 10.754 filas del smoke fixture + reset del contador materializado (drift-query 13.641 ms → 69 ms) + **auto-acotado en `canary-stats-pipeline`** (`SMOKE_FIXTURE_CAP=500` + `pruneFixtureIfNeeded()` al inicio de cada pasada) + guardarraíl. Backend desplegado.
- **P1 — Framework + exclusión analítica (PENDIENTE):** clase base `CanaryProbe` + `SYNTHETIC_USER_IDS` central + **verificar y blindar** que el smoke no contamina rankings/stats/dificultad (medir el sesgo actual de la `SMOKE_QUESTION` y del ranking del smoke user).
- **P2 — Migrar todos** los canary a la base, uno a uno y testeado.
- **P3 — Enforce:** guardarraíl CI (todo canary extiende base + write-canary acotado + sintético excluido) + runbook `canaries.md` + registro.

## Estado
- **P0: HECHO** (11/07). **P1-P3: pendientes** (backlog: `docs/roadmap/tareas-pendientes.md`).
