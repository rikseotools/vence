# Roadmap — Materialized aggregates para endpoints de estadísticas

> **Estado**: 🟡 Fase 1 PAUSADA (2026-05-26) — tabla + función creadas en prod, triggers bloqueados por lock contention en `test_questions`. Retomar siguiendo §"PUNTO DE RETOMA" abajo.
> **Propietario**: equipo Vence
> **Coste recurrente**: 0€ (todo dentro de Postgres + cron Fargate ya existente)
> **Última actualización**: 2026-05-27 13:30 CEST — plan paso-a-paso para retoma sin contexto.

---

## 🚀 PUNTO DE RETOMA — leer esto antes de tocar nada (sesión nueva 2026-05-27+)

**Contexto en 30 segundos:**
- `theme-stats` y endpoints similares agregan en runtime sobre tabla `test_questions` (~1.2M filas, 64k+ para users heavy). Latencia 10-12s para esos users → timeout → stale-while-error.
- Solución estándar industria (validada por `/api/stats v2` ya en Vence): tabla counter + triggers mantenidos write-time. Lectura sub-50ms determinista. NO depende de provider (funciona igual en Supabase, RDS, Neon).
- **Migrar a AWS NO resuelve esto** — la query agregada sería igualmente lenta. Esta es la solución correcta.

### Estado AHORA en producción (verificado 2026-05-27 13:30 CEST)

**Aplicado** (visible en BD `yqbpstxowvgipqspqrgo`):
- ✅ Tabla `user_theme_stats` (PK `(user_id, position_type, tema_number)`, índice `(user_id, position_type)`, columnas `total, correct, last_study, updated_at`). Vacía.
- ✅ Función `update_user_theme_stats()` (maneja 3 TG_OPs INSERT/UPDATE/DELETE con UPSERT). Existe pero NO se llama (sin triggers).

**Pendiente** (orden de ejecución obligatorio):
1. **Aplicar 3 triggers** sobre `test_questions` — sentencias YA escritas en `supabase/migrations/20260526_user_theme_stats_triggers.sql` (sección final).
2. **Backfill** ~1.2M filas — script aún sin escribir, ver SQL más abajo.
3. **Drift cron diario** — usar patrón de `stats_drift_log` ya existente.
4. **Endpoint dual con feature flag** — refactor de `app/api/v2/topic-progress/theme-stats/route.ts`.
5. **Cleanup** — quitar query vieja y flag tras 7 días de paridad.

**Impacto si todo falla AHORA**: cero. Nadie lee de `user_theme_stats`. Rollback total: `DROP FUNCTION update_user_theme_stats() CASCADE; DROP TABLE user_theme_stats;`

### Plan exacto paso-a-paso (copiar-pegar)

**Pre-flight check** (1 min):
```sql
-- 1. ¿Cuánto tráfico tiene test_questions ahora?
SELECT count(*)::int AS inserts_5min
FROM test_questions
WHERE created_at >= NOW() - INTERVAL '5 minutes';
-- Si <30: aplicar AHORA con lock_timeout=5s.
-- Si 30-100: posponer 1h.
-- Si >100: esperar ventana 03:00-06:00 CEST.
```

**Paso 1 — Aplicar triggers** (5 min, riesgo controlado con lock_timeout):

```bash
node -e "
const pgMod = require('./node_modules/postgres');
const postgres = pgMod.default || pgMod;
require('./node_modules/dotenv').config({path:'./.env.local'});
const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });

const triggers = [
  ['user_theme_stats_insert_trigger',
   'CREATE TRIGGER user_theme_stats_insert_trigger AFTER INSERT ON test_questions FOR EACH ROW EXECUTE FUNCTION update_user_theme_stats()'],
  ['user_theme_stats_update_trigger',
   'CREATE TRIGGER user_theme_stats_update_trigger AFTER UPDATE OF is_correct, tema_number ON test_questions FOR EACH ROW WHEN (OLD.is_correct IS DISTINCT FROM NEW.is_correct OR OLD.tema_number IS DISTINCT FROM NEW.tema_number) EXECUTE FUNCTION update_user_theme_stats()'],
  ['user_theme_stats_delete_trigger',
   'CREATE TRIGGER user_theme_stats_delete_trigger AFTER DELETE ON test_questions FOR EACH ROW EXECUTE FUNCTION update_user_theme_stats()'],
];

(async () => {
  for (const [name, createStmt] of triggers) {
    let ok = false;
    for (let i = 0; i < 5; i++) {
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe('SET LOCAL lock_timeout = \"5s\"');
          await tx.unsafe(\`DROP TRIGGER IF EXISTS \${name} ON test_questions\`);
          await tx.unsafe(createStmt);
        });
        ok = true;
        console.log('✓ ' + name);
        break;
      } catch (e) {
        console.log('  retry ' + (i+1) + '/5 ' + name + ': ' + e.message.slice(0, 80));
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!ok) {
      console.error('✗ ABORT: no se pudo aplicar ' + name + ' — esperar ventana 03-06h CEST');
      process.exit(1);
    }
  }
  console.log('\\n✓ Los 3 triggers aplicados. Smoke test → backfill.');
  await sql.end();
})();
"
```

**Paso 2 — Smoke test del trigger** (30 s):

```sql
-- Pick un user existente con tests y position_type
WITH sample AS (
  SELECT t.id AS test_id, t.user_id, t.position_type
  FROM tests t
  WHERE t.position_type IS NOT NULL AND t.user_id IS NOT NULL
  LIMIT 1
)
-- Insertar fila de prueba con tema_number=99999 (no colisiona)
INSERT INTO test_questions (test_id, user_id, question_id, is_correct, tema_number, created_at, was_blank)
SELECT test_id, user_id, gen_random_uuid(), true, 99999, NOW(), false FROM sample;

-- Verificar que user_theme_stats se actualizó:
SELECT * FROM user_theme_stats WHERE tema_number = 99999;
-- → debe haber 1 fila con total=1, correct=1

-- Limpiar:
DELETE FROM test_questions WHERE tema_number = 99999;
SELECT * FROM user_theme_stats WHERE tema_number = 99999;
-- → debe haber 1 fila con total=0, correct=0
DELETE FROM user_theme_stats WHERE tema_number = 99999;
```

**Paso 3 — Backfill** (1-5 min, read-only sobre test_questions):

```sql
-- Backfill idempotente. Lee 1.2M filas, escribe ~30k filas en user_theme_stats.
-- Usar getPoolerDb o conexión directa para evitar Supavisor timeout.
INSERT INTO user_theme_stats (user_id, position_type, tema_number, total, correct, last_study, updated_at)
SELECT
  t.user_id,
  t.position_type,
  tq.tema_number,
  COUNT(*)::int AS total,
  SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS correct,
  MAX(tq.created_at) AS last_study,
  NOW() AS updated_at
FROM tests t
INNER JOIN test_questions tq ON tq.test_id = t.id
WHERE t.position_type IS NOT NULL
  AND t.user_id IS NOT NULL
  AND tq.tema_number IS NOT NULL
GROUP BY t.user_id, t.position_type, tq.tema_number
ON CONFLICT (user_id, position_type, tema_number) DO UPDATE SET
  total = EXCLUDED.total,
  correct = EXCLUDED.correct,
  last_study = EXCLUDED.last_study,
  updated_at = NOW();
```

**Paso 4 — Paridad** (smoke test con 10 users random):

```sql
-- Comparar user_theme_stats con query vieja para 10 users heavy
WITH heavy_users AS (
  SELECT user_id FROM tests
  WHERE position_type IS NOT NULL
  GROUP BY user_id
  ORDER BY COUNT(*) DESC
  LIMIT 10
),
materialized AS (
  SELECT uts.user_id, uts.position_type, uts.tema_number, uts.total, uts.correct
  FROM user_theme_stats uts
  WHERE uts.user_id IN (SELECT user_id FROM heavy_users)
),
runtime AS (
  SELECT t.user_id, t.position_type, tq.tema_number,
         COUNT(*)::int AS total,
         SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END)::int AS correct
  FROM tests t
  INNER JOIN test_questions tq ON tq.test_id = t.id
  WHERE t.user_id IN (SELECT user_id FROM heavy_users)
    AND t.position_type IS NOT NULL
    AND tq.tema_number IS NOT NULL
  GROUP BY t.user_id, t.position_type, tq.tema_number
)
SELECT
  COALESCE(m.user_id, r.user_id) AS user_id,
  COALESCE(m.position_type, r.position_type) AS position_type,
  COALESCE(m.tema_number, r.tema_number) AS tema_number,
  m.total AS mv_total, r.total AS rt_total,
  m.correct AS mv_correct, r.correct AS rt_correct,
  CASE WHEN m.total = r.total AND m.correct = r.correct THEN 'OK' ELSE 'DRIFT' END AS verdict
FROM materialized m
FULL OUTER JOIN runtime r USING (user_id, position_type, tema_number)
WHERE m.total IS DISTINCT FROM r.total OR m.correct IS DISTINCT FROM r.correct
LIMIT 50;
-- → debe devolver 0 filas. Si hay DRIFT, NO continuar.
```

**Paso 5 — Endpoint dual con flag** (PR separado, no urgente):

- Edit `app/api/v2/topic-progress/theme-stats/route.ts`.
- Si `process.env.USE_MATERIALIZED_THEME_STATS === 'true'` → leer de `user_theme_stats` + slice 30d via `test_questions` con índice.
- Si flag OFF → comportamiento actual.
- Rollout: tu user → 10% → 50% → 100% con 24h entre cada step.

**Paso 6 — Drift cron** (PR separado):

Copiar patrón de `stats_drift_log` que ya existe. Crear cron `check-user-theme-stats-drift` diario que compare 10 users random y emita `observable_events` severity='error' si drift_pct > 5%.

### Por qué Paso 1 puede fallar y plan B

**`CREATE TRIGGER` necesita `SHARE ROW EXCLUSIVE`** que choca con `INSERT INTO test_questions` (cada `answer-and-save`). Con `lock_timeout=5s` el statement aborta en 5s sin bloquear app — los INSERTs en cola continúan después. Pero si el tráfico es alto, los 5 reintentos pueden todos fallar.

**Plan B**: ventana 03:00-06:00 CEST. Verificar con `SELECT count(*) FROM test_questions WHERE created_at > NOW() - INTERVAL '5 minutes'` que hay <5 inserts. Reintentar con `lock_timeout=10s`.

**Plan C (último recurso)**: conexión directa al puerto 5432 del Postgres (bypass Supavisor). Más probable de obtener lock pero requiere acceso directo (no via pooler). Sólo si A y B fallan.

### Antipatterns a evitar al retomar

- ❌ Aplicar triggers + cambiar endpoint en mismo deploy. **NO**. Verificar 24-48h de paridad sin lectores antes de tocar el endpoint.
- ❌ Saltar backfill. Sin él, users existentes verían contadores "0" hasta que respondan nuevas preguntas.
- ❌ Aplicar triggers en horario punta. `lock_timeout` ayuda pero crear ruido de "answer-and-save lento" durante 10-15s.
- ❌ Tocar `last_study` en DELETE (recalcular requiere SELECT MAX sobre filas restantes). Drift mínimo aceptable.

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
