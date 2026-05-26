# Roadmap — Materialized aggregates para endpoints de estadísticas

> **Estado**: 🟡 Fase 1 PAUSADA (2026-05-26) — tabla + función creadas en prod, triggers bloqueados por lock contention en `test_questions`. Retomar en ventana de bajo tráfico.
> **Propietario**: equipo Vence
> **Coste recurrente**: 0€ (todo dentro de Postgres + cron Fargate ya existente)
> **Última actualización**: 2026-05-26 22:40 CEST — diseño + Fase 1 parcial

---

## ⏸ Estado al pausar (2026-05-26 22:40 CEST)

### Aplicado en producción (Supabase eu-west-2)

- ✅ `user_theme_stats` (tabla vacía, sin lectores, PK + 1 índice) — migración `supabase/migrations/20260526_user_theme_stats_table.sql`.
- ✅ `update_user_theme_stats()` función — primera mitad de `supabase/migrations/20260526_user_theme_stats_triggers.sql`.
- **Impacto en producción ahora mismo**: cero. Tabla vacía, función no se llama, ningún endpoint la lee.
- **Rollback completo**: `DROP FUNCTION update_user_theme_stats() CASCADE; DROP TABLE user_theme_stats;`

### Pendiente — al retomar

1. **Aplicar los 3 triggers** en `test_questions` (INSERT / UPDATE / DELETE).
   - Bloqueador: `CREATE TRIGGER` necesita `SHARE ROW EXCLUSIVE` lock sobre `test_questions`. En horario con tráfico continuo (cada `answer-and-save` inserta), `lock_timeout=3s` falla en 5 retries. Probado 2026-05-26 22:30 CEST.
   - Plan: ejecutar el script siguiente en ventana de bajo tráfico (madrugada CEST). Mide tráfico previo con `SELECT count(*) FROM test_questions WHERE created_at >= NOW() - INTERVAL '10 minutes'` — si <5 inserts, intentar con `lock_timeout=10s`.
   - Sentencias preparadas en `supabase/migrations/20260526_user_theme_stats_triggers.sql` (sección "Triggers (3 TG_OPs)"). Aplicar línea por línea, una transacción por trigger.
2. **Backfill** desde `test_questions` actual (~1.2M filas, 6k users). Script idempotente `scripts/backfill-user-theme-stats.mjs` (sin escribir todavía).
3. **Verificación de paridad** post-backfill: 10 users aleatorios, comparar `SELECT * FROM user_theme_stats WHERE user_id=?` con query directa actual. Debe coincidir bit-perfect.
4. Continuar con **Fase 2** (drift cron) → **Fase 3** (endpoint dual con flag).

### Lecciones aprendidas

- **DDL sobre tablas calientes en Supabase Transaction Pooler es problemático.** El pooler aborta transacciones largas. Para CREATE TRIGGER sobre `test_questions`, intentar:
  - Conexión directa al puerto 5432 (bypass del Supavisor) — más probable de obtener el lock sin abortar.
  - Ventana 03:00–06:00 CEST (tráfico mínimo).
  - O parar transitoriamente el endpoint `answer-and-save` durante 5 s mientras se crean los 3 triggers.

---

---

## Contexto y motivación

### El síntoma

Endpoints de estadísticas agregadas por usuario (theme-stats, weak-articles, problematic-articles, dau-history) ejecutan en runtime queries del tipo:

```sql
SELECT tema_number, COUNT(*), SUM(...), MAX(...)
FROM tests t JOIN test_questions tq ON tq.test_id = t.id
WHERE t.user_id = $1 AND t.position_type = $2
GROUP BY tema_number
```

Para usuarios heavy (>30k test_questions), estas queries tardan **10-12 segundos**. La mitigación actual (`stale-while-error` con cache Redis 5 min + timeout BD 10s) sirve la mayoría de hits sub-100ms, **pero al expirar el cache el primer hit se lleva 10 s de spinner** o sirve stale silenciosamente. Verificado en producción 2026-05-26: 3 hits consecutivos a `/api/v2/topic-progress/theme-stats` con `duration_ms = 10011-10013ms` exactos (timeout → stale fallback).

### Por qué cache no es suficiente

- Cache HTTP es band-aid: cuando expira, devuelve la latencia al usuario.
- El stale-while-error tapa el síntoma pero no escala con cohortes de usuarios heavy concurrentes.
- A escala, lo profesional es **mover el cómputo al write side**, no parchearlo en el read.

### Por qué tabla materializada + triggers (no Materialized View)

Vence ya tiene precedente exitoso con el patrón **tabla counter + triggers** para `/api/stats` (5 tablas: `user_stats_summary`, `user_difficulty_stats`, `user_hourly_stats`, `user_article_stats`, `user_daily_stats`). Migrar a ese mismo patrón mantiene:

- Una sola superficie operacional (triggers, drift log, scripts de backfill).
- Frescura exacta (no stale 10 min como una MV).
- Sin coste de `REFRESH` periódico sobre el primary.

Memoria del proyecto: *"Triggers materializadores: cubrir SIEMPRE 3 TG_OPs (INSERT/UPDATE/DELETE)"* — patrón obligatorio aprendido del incidente 23/05 con `is_completed`.

### Limitación de scope

Este roadmap aplica **solo a endpoints de estadísticas agregadas pesadas y read-only**. NO incluye:

- Endpoints transaccionales (`answer-and-save`, `exam/validate`).
- Writes o lecturas read-after-write críticas.
- Endpoints ya migrados a `/api/stats` (cubiertos por el roadmap anterior).

---

## Endpoints candidatos (priorización)

| Endpoint | Síntoma | Prioridad |
|---|---|---|
| `/api/v2/topic-progress/theme-stats` | 10 s timeout consistente para users heavy | **P1 — Fase 1-7** |
| `/api/v2/topic-progress/weak-articles` | Stale-while-error activo, query similar | P2 |
| `/api/notifications/problematic-articles` | RPC pesada, >5 s en cron | P2 |
| `/api/v2/admin/dashboard/charts → DAU history` | Recalcula 30 días en cada hit | P3 |

Comenzar por theme-stats. Una vez validado el patrón en producción (Fase 7 sin regresiones por 7 días), replicar a los demás siguiendo el mismo pipeline de fases.

---

## Arquitectura propuesta

### Tabla materializada

```sql
CREATE TABLE user_theme_stats (
  user_id uuid NOT NULL,
  position_type text NOT NULL,
  tema_number int NOT NULL,
  total int NOT NULL DEFAULT 0,
  correct int NOT NULL DEFAULT 0,
  last_study timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, position_type, tema_number)
);
CREATE INDEX ON user_theme_stats (user_id, position_type);
```

### Decisión sobre los slices temporales (`total_30d`, `correct_30d`)

La query original calcula counters lifetime **y** sliding window 30d en la misma pasada. Triggers no pueden mantener una "ventana móvil" eficientemente sin recálculo periódico.

**Solución**:

- **Lifetime counters** (`total`, `correct`, `last_study`) → mantenidos por triggers (siempre frescos).
- **Slice 30d** (`total_30d`, `correct_30d`, `accuracy_30d`) → query secundaria al servir, sobre `test_questions` con índice `(user_id, tema_number, created_at)` y filtro `created_at >= NOW() - INTERVAL '30 days'`. Mucho más ligera que el agregado completo porque el filtro temporal limita las filas escaneadas (en lugar de 64k del histórico, solo las recientes).

Tradeoff: el endpoint hace **2 queries** en vez de 1. Pero las dos son trivialmente rápidas con los índices correctos: ~5 ms cada una vs los 12 s actuales.

### Triggers

Tres TG_OPs sobre `test_questions`:

- `AFTER INSERT`: `INSERT ... ON CONFLICT (user_id, position_type, tema_number) DO UPDATE SET total = total + 1, correct = correct + new.is_correct::int, last_study = GREATEST(last_study, new.created_at)`.
- `AFTER UPDATE` (solo si cambia `is_correct` o `tema_number`): ajustar contadores.
- `AFTER DELETE`: decrementar contadores.

`user_id` y `position_type` se obtienen vía join con `tests` en el trigger (denormalizando si hace falta, igual que ya hace `test_questions.user_id`).

### Drift detection

Cron periódico (diario) compara muestras (10 users aleatorios) entre `user_theme_stats` y la query directa sobre `test_questions`. Cualquier divergencia se loguea a `stats_drift_log` (tabla ya existente). Alerta si `drift_pct > 5%`.

### Backfill

Script idempotente `scripts/backfill-user-theme-stats.mjs` que:

1. Vacía la tabla.
2. Recalcula con un único `INSERT ... SELECT` desde `test_questions JOIN tests`.
3. Reporta filas y tiempo.

Se ejecuta una vez al desplegar la Fase 1, antes de activar el feature flag de lectura.

---

## Fases

### Fase 1 — Tabla + triggers + backfill (esqueleto sin lectores)

**Objetivo**: dejar la tabla viva y siempre fresca en producción, **sin que ningún endpoint la lea todavía**.

Entregables:

- `supabase/migrations/YYYYMMDD_user_theme_stats_table.sql` — `CREATE TABLE` + índices.
- `supabase/migrations/YYYYMMDD_user_theme_stats_triggers.sql` — 3 triggers (INSERT/UPDATE/DELETE) sobre `test_questions`.
- `scripts/backfill-user-theme-stats.mjs` — backfill idempotente desde `test_questions` actual.
- Verificación: ejecutar backfill en staging/local, comparar 10 users aleatorios contra query directa, paridad 100%.

Criterio de éxito Fase 1:

- ✅ Tabla creada y poblada con datos coherentes.
- ✅ Triggers activos: insertar un test nuevo localmente y ver que la tabla se actualiza.
- ✅ Cero impacto en endpoints actuales (siguen leyendo de `test_questions` directamente).

Rollback: `DROP TABLE user_theme_stats CASCADE`. Las migrations son aditivas, no destructivas.

### Fase 2 — Drift detection diario

**Objetivo**: detectar desincronización entre la tabla materializada y la realidad antes de empezar a leer de ella.

Entregables:

- Cron Fargate `check-theme-stats-drift` (diario).
- Función SQL `check_user_theme_stats_drift(sample_size int)` que compara muestras y loguea a `stats_drift_log`.
- Alerta si `drift_pct > 5%`.

Criterio de éxito Fase 2: 7 días seguidos con `drift_pct < 1%` en muestras.

### Fase 3 — Endpoint con feature flag (lectura dual)

**Objetivo**: el endpoint puede leer de la nueva tabla, pero **detrás de flag OFF por defecto**.

Entregables:

- `app/api/v2/topic-progress/theme-stats/route.ts`: si `USE_MATERIALIZED_THEME_STATS=true`, lee de `user_theme_stats` + slice 30d via query secundaria. Si OFF, comportamiento actual.
- Tests unitarios sobre el camino nuevo (lectura + slice 30d).
- Test de paridad: query nueva vs vieja sobre N users heavy.

Criterio de éxito Fase 3: flag ON en local + tu user (Manuel) en producción, métricas sub-50ms, output bit-perfect comparado con el camino viejo.

### Fase 4 — Rollout gradual

**Objetivo**: activar la lectura en producción de forma controlada.

Steps:

1. Flag ON solo para usuarios admin (whitelist en código).
2. Flag ON para 10% de tráfico (sampling deterministic por user_id).
3. Flag ON para 50%.
4. Flag ON para 100%.

Entre cada step: 24h de observación + comprobación de SLOs (latencia p95 < 100ms, 0 errores 5xx, drift_pct < 1%).

Criterio de éxito Fase 4: 100% del tráfico durante 7 días con latencia p95 sub-100ms y 0 incidentes.

### Fase 5 — Limpieza

**Objetivo**: eliminar el camino viejo y el flag.

Entregables:

- Borrar la query agregada vieja del route.
- Eliminar `USE_MATERIALIZED_THEME_STATS` y el branching.
- Eliminar Redis cache (`getCached`/`setCached`) del endpoint — ya no hace falta porque la BD responde sub-50ms.
- Actualizar tests.

Criterio de éxito Fase 5: code review limpio, tests verdes, deploy sin regresiones.

### Fase 6 — Documentación

Actualizar `docs/runbooks/health-check.md` y `docs/database/tablas.md` con la nueva tabla + drift detection.

### Fase 7 — Replicar el patrón

Aplicar el mismo pipeline (Fase 1-6) a:

- `/api/v2/topic-progress/weak-articles`
- `/api/notifications/problematic-articles`
- `/api/v2/admin/dashboard/charts` (DAU history)

Cada uno como PR separado, con su propio drift log.

---

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Trigger bug → datos divergen sin avisar | Media | Alto | Drift cron diario + alerta + tests de paridad antes del cutover |
| Trigger ralentiza INSERT a `test_questions` (path crítico answer-and-save) | Media | Alto | Benchmark del trigger antes de habilitarlo (`EXPLAIN ANALYZE`). Si añade >2ms al INSERT, refactor a outbox/worker async |
| Schema migration de `tests`/`test_questions` rompe la consistencia | Baja | Alto | Documentar en `db/schema.ts` y `docs/database/tablas.md` que estas tablas son fuente de triggers. Pre-commit check opcional |
| Backfill lento (>10 min) bloqueando deploy | Media | Medio | Script idempotente con `INSERT ... ON CONFLICT DO NOTHING`. Si lento, ejecutar en background tras deploy |
| Cron de drift cae sin detectar | Baja | Medio | Liveness check vía `__cron_run__` en `stats_drift_log` (patrón ya existente) |
| Read-after-write: usuario completa un test y abre stats antes de que el trigger commit | Muy baja | Bajo | Triggers `AFTER INSERT` son síncronos en la misma transacción → no hay window de inconsistencia visible |

---

## Comparación con cache-only (status quo)

| | Cache 5 min + stale-while-error (hoy) | Tabla materializada + triggers (propuesto) |
|---|---|---|
| Latencia user heavy | 10 s peor caso | < 50 ms siempre |
| Latencia mayoría | < 100 ms (cache hit) | < 50 ms |
| Datos stale | 5 min | 0 (fresh siempre) |
| Carga primary en lectura | Picos cuando expira cache | Constante baja (PK lookup) |
| Carga primary en escritura | 0 | +~1-2 ms por INSERT a `test_questions` |
| Read-after-write | Funciona si invalidas cache | Funciona nativo |
| Objetos a mantener | Query + Redis | Tabla + 3 triggers + cron drift + script backfill |
| Bug observable cómo | Test directo lento | Drift > 5% en `stats_drift_log` |

---

## Notas de implementación

- Memoria del proyecto: *"Triggers materializadores: cubrir SIEMPRE 3 TG_OPs (INSERT/UPDATE/DELETE) + UPSERT + smoke verify dentro de migración"*. Aplicar al pie de la letra.
- Memoria: *"Validación activa > soak por calendario"*. Forzar inserts + deletes + updates en test para validar triggers, en lugar de esperar 24h a que pase tráfico real.
- Memoria: *"Antes de DROP/DELETE/ALTER: auditoría completa de readers/writers"*. La Fase 5 (cleanup) debe auditar grepeando referencias antes de borrar el camino viejo.
