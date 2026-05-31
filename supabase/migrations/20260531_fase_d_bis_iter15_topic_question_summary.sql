-- Fase D-bis Iter 1.5 — Materialized view topic_question_summary
-- Aplicar 2026-05-31. Reversible: DROP MATERIALIZED VIEW topic_law_question_summary, topic_official_by_position.
--
-- Problema:
--   - /api/topics/[numero] dispara 5xx 503 "saturado" (12s timeout) bajo
--     cold path. Causa: getQuestionsForTopic hace N queries serializadas
--     (una por scopeMapping/ley) + COUNT DISTINCT con JOINs sobre la tabla
--     questions (90.680 filas activas). pg_stat_statements 31/05:
--       mean 2956ms / max 7310ms en la query principal.
--   - Combinado con userProgress (~1-3s), cold cache hit → >12s → timeout.
--
-- Solución (CQRS-light, sin triggers — datos topic-level cambian lentamente):
--   1. MV topic_law_question_summary: agregados de questions por (topic,law)
--      con counts pre-calculados por bucket de dificultad. PK lookup ~1ms.
--   2. MV topic_official_by_position: counts is_official_exam por (topic,position)
--      para que el filtro per-oposición (validExamPositions = EXAM_POSITION_MAP)
--      sea un PK lookup en lugar de table scan + filter.
--   3. Función helper topic_question_difficulty_bucket(global, base) —
--      idéntica lógica a processDifficultyStats en TS, garantiza paridad.
--   4. REFRESH MATERIALIZED VIEW CONCURRENTLY: scheduled cron nightly
--      + endpoint admin refresh on-demand para invalidar tras edits.
--
-- Paridad: tests verifican bit-a-bit que (counts, articlesByLaw, official)
-- coinciden con getQuestionsForTopic + processDifficultyStats antiguos para
-- N=50+ pares (topic, oposición) aleatorios.
--
-- Bench esperado (a confirmar tras deploy):
--   - p50 /api/topics/[numero] cold: ~4-7s → ~50-150ms (40-80×).
--   - p95: timeout 12s → ~300ms.
--   - Sin impacto en write path (write amplification = 0).

-- ────────────────────────────────────────────────────────────────
-- 1) Función helper inmutable — espejo de processDifficultyStats TS
-- ────────────────────────────────────────────────────────────────
-- Misma lógica que lib/api/topic-data/queries.ts:processDifficultyStats:
--   - Si hay global_difficulty: buckets 0-25 easy, 25-50 medium, 50-75 hard, 75+ extreme.
--   - Si no: usa difficulty estática (easy|medium|hard|extreme|auto), default 'auto'.

CREATE OR REPLACE FUNCTION topic_question_difficulty_bucket(
  global_diff numeric,
  base_diff text
) RETURNS text
IMMUTABLE LANGUAGE SQL AS $$
  SELECT CASE
    WHEN global_diff IS NOT NULL AND global_diff < 25 THEN 'easy'
    WHEN global_diff IS NOT NULL AND global_diff < 50 THEN 'medium'
    WHEN global_diff IS NOT NULL AND global_diff < 75 THEN 'hard'
    WHEN global_diff IS NOT NULL THEN 'extreme'
    WHEN base_diff IN ('easy','medium','hard','extreme','auto') THEN base_diff
    ELSE 'auto'
  END
$$;

COMMENT ON FUNCTION topic_question_difficulty_bucket(numeric, text) IS
  'Espejo inmutable de processDifficultyStats en lib/api/topic-data/queries.ts. '
  'Si cambia la lógica en TS, actualizar también esta función y refrescar las MV.';

-- ────────────────────────────────────────────────────────────────
-- 2) MV topic_law_question_summary — agregados por (topic, law)
-- ────────────────────────────────────────────────────────────────
-- Una fila por cada (topic_id, law_id) presente en topic_scope. Para temas
-- sin questions vinculadas, la fila existe igual con counts=0 (gracias al
-- LEFT JOIN), de forma que el endpoint puede listar todas las leyes del
-- topic_scope sin tener que consultarlas por separado.

CREATE MATERIALIZED VIEW topic_law_question_summary AS
SELECT
  ts.topic_id,
  ts.law_id,
  l.short_name           AS law_short_name,
  l.name                 AS law_name,
  COUNT(q.id)::int       AS total_questions,
  COUNT(DISTINCT a.id) FILTER (WHERE q.id IS NOT NULL)::int AS articles_with_questions,
  COUNT(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'easy')::int    AS count_easy,
  COUNT(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'medium')::int  AS count_medium,
  COUNT(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'hard')::int    AS count_hard,
  COUNT(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'extreme')::int AS count_extreme,
  COUNT(*) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'auto')::int    AS count_auto,
  NOW()                  AS computed_at
FROM topic_scope ts
JOIN laws l ON ts.law_id = l.id
LEFT JOIN articles a ON a.law_id = l.id
  AND (
    ts.article_numbers IS NULL
    OR a.article_number = ANY(ts.article_numbers)
  )
LEFT JOIN questions q ON q.primary_article_id = a.id
  AND q.is_active = true
  AND q.exam_case_id IS NULL
GROUP BY ts.topic_id, ts.law_id, l.short_name, l.name;

-- PK + soporte para REFRESH MATERIALIZED VIEW CONCURRENTLY.
CREATE UNIQUE INDEX topic_law_question_summary_pk
  ON topic_law_question_summary (topic_id, law_id);

-- Lookup principal del endpoint: SELECT WHERE topic_id=$1.
CREATE INDEX topic_law_question_summary_topic_idx
  ON topic_law_question_summary (topic_id);

COMMENT ON MATERIALIZED VIEW topic_law_question_summary IS
  'Fase D-bis Iter 1.5 — agregados pre-calculados por (topic_id, law_id) '
  'para getTopicFullData. Refresh nightly + on-demand admin. '
  'Si cambia la lógica de filtrado o de buckets, actualizar topic_question_difficulty_bucket y refrescar.';

-- ────────────────────────────────────────────────────────────────
-- 3) MV topic_official_by_position — counts oficiales por (topic, exam_position)
-- ────────────────────────────────────────────────────────────────
-- El endpoint filtra por validExamPositions = EXAM_POSITION_MAP[positionType],
-- que es un array de strings (p.ej. para auxiliar_administrativo_estado:
-- ['auxiliar_administrativo_estado', 'auxiliar_administrativo_seguridad_social', ...]).
-- Precomputar por position permite que el endpoint haga:
--   SELECT SUM(official_questions) FROM topic_official_by_position
--   WHERE topic_id=$1 AND exam_position = ANY($2);
-- → PK lookup + sum, sin tocar `questions`.

CREATE MATERIALIZED VIEW topic_official_by_position AS
SELECT
  ts.topic_id,
  LOWER(q.exam_position) AS exam_position,
  COUNT(*)::int          AS official_questions,
  NOW()                  AS computed_at
FROM topic_scope ts
JOIN articles a ON a.law_id = ts.law_id
  AND (
    ts.article_numbers IS NULL
    OR a.article_number = ANY(ts.article_numbers)
  )
JOIN questions q ON q.primary_article_id = a.id
WHERE q.is_active = true
  AND q.exam_case_id IS NULL
  AND q.is_official_exam = true
  AND q.exam_position IS NOT NULL
GROUP BY ts.topic_id, LOWER(q.exam_position);

CREATE UNIQUE INDEX topic_official_by_position_pk
  ON topic_official_by_position (topic_id, exam_position);

CREATE INDEX topic_official_by_position_topic_idx
  ON topic_official_by_position (topic_id);

COMMENT ON MATERIALIZED VIEW topic_official_by_position IS
  'Fase D-bis Iter 1.5 — counts is_official_exam por (topic_id, exam_position). '
  'Permite filtro per-oposición vía exam_position = ANY(validExamPositions) en PK lookup.';

-- ────────────────────────────────────────────────────────────────
-- 4) Función refresh — REFRESH CONCURRENTLY (no bloquea SELECT)
-- ────────────────────────────────────────────────────────────────
-- REFRESH CONCURRENTLY requiere los UNIQUE INDEX creados arriba. No bloquea
-- las queries en curso. Tarda más que REFRESH no-concurrente, pero el
-- coste es asumible para datos que cambian de noche.

CREATE OR REPLACE FUNCTION refresh_topic_question_summary()
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  t0 timestamptz := clock_timestamp();
  t1 timestamptz;
  t2 timestamptz;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY topic_law_question_summary;
  t1 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY topic_official_by_position;
  t2 := clock_timestamp();
  RETURN jsonb_build_object(
    'success',                 true,
    'topic_law_summary_ms',    EXTRACT(MILLISECONDS FROM (t1 - t0))::int,
    'topic_official_ms',       EXTRACT(MILLISECONDS FROM (t2 - t1))::int,
    'total_ms',                EXTRACT(MILLISECONDS FROM (t2 - t0))::int,
    'refreshed_at',            t2
  );
END $$;

COMMENT ON FUNCTION refresh_topic_question_summary() IS
  'Refresca las 2 MVs de Fase D-bis Iter 1.5 con REFRESH CONCURRENTLY. '
  'Llamada por cron @4am UTC (cron refresh-topic-summary) y por endpoint admin tras edits.';
