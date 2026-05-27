# Roadmap — Performance `/api/v2/topic-progress/weak-articles`

> **Estado**: 🟡 Fase 1 EN MARCHA (2026-05-27) — índice cubriente del filtro WHERE pendiente de aplicar y medir.
> **Propietario**: equipo Vence
> **Coste recurrente**: 0€ (solo índice + posiblemente denormalización Fase 2)
> **Última actualización**: 2026-05-27 ~14:00 CEST.

---

## 🚀 PUNTO DE RETOMA — leer antes de tocar nada

**Contexto en 30 segundos:**

- `/api/v2/topic-progress/weak-articles` devuelve los artículos donde el usuario tiene menor `success_rate` en `user_question_history` (tabla ya agregada por pregunta).
- 7 días recientes: 386 eventos en `observable_events` (sample 10% éxitos + 100% errores). **50 status 5xx** + p99=15s (timeout duro), p95=650ms, p50=31ms.
- La media es rápida pero los **users heavy se cuelgan**. Patrón típico: hot endpoint con cola larga.
- NO usa `test_questions` directamente — el patrón de `oposiciones-compatibles` (uas + SUM por article_id) **NO aplica directo**: cambiaría semántica (question-level vs article-level).
- Plan: 3 fases incrementales con **medir entre cada una** y solo escalar si la anterior no resuelve.

**Tabla origen y filtro real (endpoint actual):**

```sql
SELECT uqh.success_rate, uqh.total_attempts, a.article_number, a.law_id, l.short_name
FROM user_question_history uqh
INNER JOIN questions q ON q.id = uqh.question_id
INNER JOIN articles a ON a.id = q.primary_article_id
INNER JOIN laws l ON l.id = a.law_id
WHERE uqh.user_id = $1
  AND uqh.success_rate < 0.60   -- default maxSuccessRate=60
  AND uqh.total_attempts >= 2   -- default minAttempts=2
```

Luego agrupa client-side por (law_id, article_number) → topic_number via `topic_scope` → top-N por tema.

**Tamaño de la tabla (2026-05-27):**

- `user_question_history`: **783.138 filas**
- Filas que matchean el WHERE por defecto: ~78k globalmente.
- User heavy ejemplo (b8342672...): 1.856 weak rows, fetch crudo en 200ms desde réplica.
- Los timeouts se concentran en users con miles de weak rows + JOIN cuádruple.

**Índices actuales en `user_question_history` (verificado en `db/schema.ts`):**

- single column en `user_id`
- single column en `success_rate`
- single column en `question_id`
- UNIQUE en `(user_id, question_id)`
- ningún índice compuesto que cubra el WHERE real del endpoint.

---

## Fases

### Fase 1 — Índice cubriente del WHERE (5 min, riesgo cero)

**Acción:** `CREATE INDEX CONCURRENTLY` sobre `user_question_history (user_id, total_attempts) WHERE success_rate < 0.6`.

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_uqh_user_weak
ON user_question_history (user_id, total_attempts)
WHERE success_rate < 0.6;
```

Migración: `supabase/migrations/20260527_uqh_idx_user_weak.sql`.

**Por qué es production-safe:**

- `CONCURRENTLY` toma sólo `SHARE UPDATE EXCLUSIVE`, no bloquea reads ni writes en `user_question_history`.
- Construcción más lenta pero no afecta tráfico.
- Partial index `WHERE success_rate < 0.6` minimiza tamaño (solo indexa filas relevantes para el endpoint).
- 0% riesgo regresión funcional: es un índice puro, no toca código de aplicación.

**Cómo ejecutar:**

`CONCURRENTLY` **no funciona en transaction mode** (Supavisor pgbouncer en port 6543). Requiere conexión directa al port 5432 o el self-hosted pooler en session mode. Usar `DATABASE_URL` directo (no `DATABASE_URL_SELF_POOLER`), o ejecutar vía Supabase Dashboard SQL Editor manualmente.

**Cómo medir (24-48h después):**

Query a `observable_events` filtrando endpoint=`/api/v2/topic-progress/weak-articles`:
- Status 5xx en ventana 7d. Esperado: de **50 → <5**.
- p95 de status=200. Esperado: de **650ms → <300ms**.
- p99 de status=200. Esperado: de **15s → <2s**.

Si las tres caen como se espera → **Fase 1 suficiente, parar**.
Si los timeouts persisten para alguna cohorte → Fase 2.

**Rollback:** `DROP INDEX CONCURRENTLY idx_uqh_user_weak;` (también safe).

---

### Fase 2 — Denormalizar `law_id` + `article_number` en `user_question_history` (1h, riesgo bajo)

Solo si Fase 1 no basta.

**Acción:**

1. `ALTER TABLE user_question_history ADD COLUMN cached_law_id uuid, ADD COLUMN cached_article_number text;`
2. Backfill: `UPDATE uqh SET cached_law_id = a.law_id, cached_article_number = a.article_number FROM questions q JOIN articles a ON a.id = q.primary_article_id WHERE uqh.question_id = q.id;`
3. Trigger AFTER INSERT/UPDATE en `user_question_history` que rellena los cached.
4. Refactor del endpoint: elimina los 3 JOINs (`questions`, `articles`, `laws`) y solo necesita `laws` para `short_name` final (un JOIN). Mejor aún: cachear `law_short_name` en `laws` en un Map en memoria (catálogo pequeño).

**Por qué es bajo riesgo:**

- Columnas nuevas con valor `null` inicialmente — no afecta a la app existente.
- Backfill puede correrse en batches sin bloquear (UPDATE por chunks de user_id).
- El trigger nuevo es paralelo al existente, no lo reemplaza.
- Refactor del endpoint: PR separado, validar con script de paridad antes de mergear.

**Coste esperado de la query post-Fase 2:** scan del partial index (Fase 1) + lookup directo de columns cached. p99 esperado: **<500ms** incluso para users de 5k+ weak rows.

---

### Fase 3 — Materializar `weak_article_summary` (3-4h, riesgo medio)

Solo si Fase 2 sigue siendo insuficiente (improbable, pero documentado por completitud).

**Acción:**

1. Tabla `weak_article_summary (user_id, law_id, article_number, weak_question_count, total_attempts_sum, avg_success_rate, updated_at)` con PK compuesta.
2. Triggers AFTER UPDATE en `user_question_history` que mantienen la fila correspondiente (incremental, no full recompute).
3. Backfill desde `user_question_history`.
4. Endpoint pasa a SELECT directo de `weak_article_summary` + agrupación por tema vía `topic_scope`.
5. Drift cron diario comparando contra cálculo runtime.
6. Endpoint dual con feature flag + rollout gradual.

Patrón ya probado en el proyecto (cf. [`materialized-stats-aggregates.md`](materialized-stats-aggregates.md) para theme-stats).

**Por qué último recurso:**

- Triggers de mantenimiento añaden coste write-time a `user_question_history` (cada respuesta).
- Más superficie de fallo (drift entre runtime y materializado).
- Solo se justifica si Fases 1+2 no logran p99 razonable.

---

## Antipatterns a evitar al retomar

- ❌ Saltar Fase 1 directamente a refactor. **NO**. Un índice apropiado resuelve el 80% de los casos. Demostrarlo primero.
- ❌ Aplicar `CREATE INDEX` SIN `CONCURRENTLY` en horario laboral. Bloquearía writes a `user_question_history` que se escribe en cada respuesta de un test.
- ❌ Cambiar semántica (question-level → article-level) sin validar producto. El endpoint actual marca un artículo como "weak" si tiene **al menos una** pregunta con `success_rate < 0.6`. Una métrica article-level diluye eso y puede ocultar artículos donde el user tiene una sola pregunta crítica fallada.
- ❌ Materializar (Fase 3) sin haber probado primero las Fases 1 y 2. Sobre-ingeniería.

---

## Criterios de éxito globales

Endpoint sano cuando se cumple **todo lo siguiente** simultáneamente en una ventana 7d:

- 0 errores 5xx atribuibles a timeout BD (`'weak-articles timeout'`).
- p99 status=200 < 2.000ms.
- p95 status=200 < 500ms.
- p50 status=200 < 100ms (ya se cumple — proteger).

---

## Métricas baseline (2026-05-27, pre-Fase 1)

Ventana 7 días, fuente `observable_events`:

- Total eventos: 386 (sample 10% éxitos + 100% errores).
- Status 200: 336.
- Status 500: **50** (~13% sobre los eventos visibles).
- Latencias 200: p50=31ms, p95=650ms, **p99=15.007ms**, max=15.016ms.
- Errores `weak-articles timeout` confirmados: presentes (ver `error_message`).

Guardar este snapshot — comparar tras Fase 1 con ventana 7d post-aplicación.

---

## Relacionado

- [`materialized-stats-aggregates.md`](materialized-stats-aggregates.md) — patrón hermano para theme-stats (test_questions agg).
- ARCHITECTURE_ROADMAP.md § Bloque 4 (Materializar pendientes + resiliencia).
- Commit `5027a941` — referencia de aplicación exitosa del patrón uas+SUM en `/api/v2/oposiciones-compatibles/progress` (paridad 14/14, 18s→835ms).
- Commit `b832517a` — fix upstream `answer-and-save` que ya rellena `article_id` server-side (relevante para que Fase 2 cached_law_id no quede null para respuestas nuevas).
