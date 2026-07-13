-- 20260713_law_question_counts_matview.sql
--
-- Conteo de preguntas por ley PRECOMPUTADO en una materialized view, para que
-- /leyes (getLawsWithQuestionCounts) no ejecute el agregado pesado
-- laws×articles×questions EN CADA REQUEST. Ese agregado tardaba ~1,7s normal pero
-- >15s bajo contención de RDS → timeout → la página mostraba "No hay leyes
-- disponibles" (bug Alfonso, 13/07). Ahora es una lectura indexada de ms.
--
-- Se refresca junto al resto de MVs en refresh_topic_question_summary() (cron),
-- así que no requiere cron propio ni queda stale más que ese ciclo.
-- Aplicada en RDS el 13/07/2026 (este fichero es el registro).

CREATE MATERIALIZED VIEW IF NOT EXISTS public.law_question_counts AS
SELECT
  l.id AS law_id,
  count(q.id)::int AS question_count,
  count(q.id) FILTER (WHERE q.is_official_exam = true)::int AS official_count
FROM laws l
LEFT JOIN articles a ON a.law_id = l.id
LEFT JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
GROUP BY l.id;

-- índice UNIQUE requerido por REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS law_question_counts_law_id_idx
  ON public.law_question_counts (law_id);

-- Engancha la MV al refresh existente (topic_law_question_summary +
-- topic_official_by_position) → misma cadencia, un solo job.
CREATE OR REPLACE FUNCTION public.refresh_topic_question_summary()
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  t0 timestamptz := clock_timestamp();
  t1 timestamptz; t2 timestamptz; t3 timestamptz;
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY topic_law_question_summary;  t1 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY topic_official_by_position;  t2 := clock_timestamp();
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.law_question_counts;  t3 := clock_timestamp();
  RETURN jsonb_build_object(
    'success',              true,
    'topic_law_summary_ms', EXTRACT(MILLISECONDS FROM (t1 - t0))::int,
    'topic_official_ms',    EXTRACT(MILLISECONDS FROM (t2 - t1))::int,
    'law_counts_ms',        EXTRACT(MILLISECONDS FROM (t3 - t2))::int,
    'total_ms',             EXTRACT(MILLISECONDS FROM (t3 - t0))::int,
    'refreshed_at',         t3
  );
END $function$;
