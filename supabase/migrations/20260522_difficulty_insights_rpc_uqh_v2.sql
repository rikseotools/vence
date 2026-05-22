-- Migracion: RPCs de difficulty-insights -> user_question_history_v2
-- Fecha: 2026-05-22
--
-- Contexto: el endpoint /api/v2/difficulty-insights llamaba a 4 RPCs que
-- escaneaban test_questions (1,2M filas / 3,2 GB) en cada hit. Para heavy
-- users (caso Nila, 33k+ test_questions) tardaban 8-37s y daban 503.
-- Las RPCs se reescriben para leer de user_question_history_v2 (tabla
-- materializada por triggers; agregados (user_id, question_id) verificados
-- exactos contra test_questions). 'trend' y 'last_attempt' se calculan
-- frescos para las filas del resultado.
--
-- Resultado verificado (simulaciones old-vs-new, 35-45 usuarios, 0 diff):
--   get_struggling_questions     Nila 33s  -> <1s
--   get_mastered_questions       Nila 29s  -> <1s
--   get_user_progress_trends     Nila timeout -> 82ms
--   get_user_difficulty_metrics  Nila 29s  -> ~100ms (templado)
--
-- NOTA - bugs preexistentes en user_question_history_v2 (NO corregidos
-- aqui; las RPCs los esquivan calculando fresco):
--   * v2.last_attempt_at: ~5-20% de filas desviadas (guarda el created_at
--     del ultimo INSERT, no el MAX) - hasta ~199 dias en Nila.
--   * v2.trend: 100% 'stable' en las 745k filas; el trigger nunca calcula
--     improving/declining. Columna muerta.
--
-- Los indices se crearon en produccion con CREATE INDEX CONCURRENTLY
-- (test_questions es tabla caliente de 3,2 GB). Aqui van como
-- CREATE INDEX IF NOT EXISTS (no-concurrent) para DBs nuevas/dev.

-- == Indices ============================================================
CREATE INDEX IF NOT EXISTS idx_tq_user_question_created
  ON test_questions (user_id, question_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tq_user_created_correct
  ON test_questions (user_id, created_at) INCLUDE (is_correct);

-- == RPCs reescritas ====================================================

CREATE OR REPLACE FUNCTION public.get_struggling_questions(p_user_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(question_id uuid, question_text text, total_attempts integer, success_rate numeric, last_attempt timestamp with time zone, trend text, personal_difficulty numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT uqh.question_id AS q_id, uqh.total_attempts AS ta,
           uqh.correct_attempts::numeric * 100.0 / uqh.total_attempts AS sr
    FROM user_question_history_v2 uqh
    WHERE uqh.user_id = p_user_id AND uqh.total_attempts >= 2
  ),
  s AS (
    SELECT base.q_id, base.ta, base.sr FROM base
    WHERE base.sr < 60
    ORDER BY base.sr ASC, base.ta DESC, base.q_id ASC
    LIMIT p_limit
  ),
  detail AS (
    SELECT tq.question_id AS qid,
      MAX(tq.created_at) AS last_at,
      COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '7 days') AS c7,
      SUM(CASE WHEN tq.is_correct AND tq.created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS ok7,
      COUNT(*) FILTER (WHERE tq.created_at <= NOW() - INTERVAL '7 days') AS cold,
      SUM(CASE WHEN tq.is_correct AND tq.created_at <= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) AS okold
    FROM test_questions tq
    WHERE tq.user_id = p_user_id AND tq.question_id IN (SELECT s.q_id FROM s)
    GROUP BY tq.question_id
  )
  SELECT s.q_id, q.question_text, s.ta::integer, ROUND(s.sr, 2),
    d.last_at,
    (CASE
      WHEN d.c7 = 0 THEN 'stable'
      WHEN d.c7 >= 2 AND (d.ok7::numeric / d.c7) > (d.okold::numeric / NULLIF(d.cold, 0)) THEN 'improving'
      WHEN d.c7 >= 2 AND (d.ok7::numeric / d.c7) < (d.okold::numeric / NULLIF(d.cold, 0)) THEN 'declining'
      ELSE 'stable'
    END)::text,
    ROUND(100 - s.sr, 2)
  FROM s
  JOIN questions q ON q.id = s.q_id
  LEFT JOIN detail d ON d.qid = s.q_id
  ORDER BY s.sr ASC, s.ta DESC, s.q_id ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_mastered_questions(p_user_id uuid, p_limit integer DEFAULT 5)
 RETURNS TABLE(question_id uuid, question_text text, total_attempts integer, success_rate numeric, last_attempt timestamp with time zone, personal_difficulty numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT uqh.question_id AS q_id, uqh.total_attempts AS ta,
           uqh.correct_attempts::numeric * 100.0 / uqh.total_attempts AS sr
    FROM user_question_history_v2 uqh
    WHERE uqh.user_id = p_user_id AND uqh.total_attempts >= 2
  ),
  s AS (
    SELECT base.q_id, base.ta, base.sr FROM base
    WHERE base.sr >= 80
    ORDER BY base.sr DESC, base.ta DESC, base.q_id ASC
    LIMIT p_limit
  ),
  la AS (
    SELECT tq.question_id AS q_id, MAX(tq.created_at) AS mx
    FROM test_questions tq
    WHERE tq.user_id = p_user_id AND tq.question_id IN (SELECT s.q_id FROM s)
    GROUP BY tq.question_id
  )
  SELECT s.q_id, q.question_text, s.ta::integer, ROUND(s.sr, 2),
         la.mx, ROUND(100 - s.sr, 2)
  FROM s
  JOIN questions q ON q.id = s.q_id
  LEFT JOIN la ON la.q_id = s.q_id
  ORDER BY s.sr DESC, s.ta DESC, s.q_id ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_progress_trends(p_user_id uuid)
 RETURNS TABLE(total integer, improving integer, stable integer, declining integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH active AS (
    SELECT DISTINCT tq.question_id AS qid
    FROM test_questions tq
    WHERE tq.user_id = p_user_id
      AND tq.question_id IS NOT NULL
      AND tq.created_at > NOW() - INTERVAL '14 days'
  ),
  recent7 AS (
    SELECT tq.question_id AS qid,
      COUNT(*) AS c7,
      SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END) AS ok7
    FROM test_questions tq
    WHERE tq.user_id = p_user_id
      AND tq.question_id IS NOT NULL
      AND tq.created_at > NOW() - INTERVAL '7 days'
    GROUP BY tq.question_id
  ),
  qt AS (
    SELECT (CASE
      WHEN COALESCE(r.c7, 0) < 2 THEN 'stable'
      WHEN (r.ok7::numeric / r.c7) >
           ((uqh.correct_attempts - r.ok7)::numeric / NULLIF(uqh.total_attempts - r.c7, 0))
        THEN 'improving'
      WHEN (r.ok7::numeric / r.c7) <
           ((uqh.correct_attempts - r.ok7)::numeric / NULLIF(uqh.total_attempts - r.c7, 0))
        THEN 'declining'
      ELSE 'stable'
    END) AS trend
    FROM user_question_history_v2 uqh
    JOIN active a ON a.qid = uqh.question_id
    LEFT JOIN recent7 r ON r.qid = uqh.question_id
    WHERE uqh.user_id = p_user_id AND uqh.total_attempts >= 2
  )
  SELECT
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE qt.trend = 'improving')::integer,
    COUNT(*) FILTER (WHERE qt.trend = 'stable')::integer,
    COUNT(*) FILTER (WHERE qt.trend = 'declining')::integer
  FROM qt;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_user_difficulty_metrics(p_user_id uuid)
 RETURNS TABLE(user_id uuid, total_questions_attempted integer, questions_mastered integer, questions_struggling integer, avg_personal_difficulty numeric, accuracy_trend text, last_updated timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN QUERY
  WITH uqs AS (
    SELECT uqh.total_attempts AS attempts,
           ROUND(uqh.correct_attempts::numeric * 100.0 / uqh.total_attempts, 2) AS success_rate
    FROM user_question_history_v2 uqh
    WHERE uqh.user_id = p_user_id
  ),
  recent_accuracy AS (
    SELECT CASE
      WHEN COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '15 days') = 0 THEN 'stable'
      WHEN (SUM(CASE WHEN tq.is_correct AND tq.created_at > NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::numeric * 100.0 /
            NULLIF(COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '15 days'), 0)) >
           (SUM(CASE WHEN tq.is_correct AND tq.created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::numeric * 100.0 /
            NULLIF(COUNT(*) FILTER (WHERE tq.created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days'), 0))
        THEN 'improving'
      WHEN (SUM(CASE WHEN tq.is_correct AND tq.created_at > NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::numeric * 100.0 /
            NULLIF(COUNT(*) FILTER (WHERE tq.created_at > NOW() - INTERVAL '15 days'), 0)) <
           (SUM(CASE WHEN tq.is_correct AND tq.created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days' THEN 1 ELSE 0 END)::numeric * 100.0 /
            NULLIF(COUNT(*) FILTER (WHERE tq.created_at BETWEEN NOW() - INTERVAL '30 days' AND NOW() - INTERVAL '15 days'), 0))
        THEN 'declining'
      ELSE 'stable'
    END AS trend
    FROM test_questions tq
    WHERE tq.user_id = p_user_id
      AND tq.created_at > NOW() - INTERVAL '30 days'
  )
  SELECT
    p_user_id,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE uqs.success_rate >= 80 AND uqs.attempts >= 2)::integer,
    COUNT(*) FILTER (WHERE uqs.success_rate < 50 AND uqs.attempts >= 2)::integer,
    ROUND(AVG(CASE WHEN uqs.success_rate > 0 THEN (100 - uqs.success_rate) ELSE 50 END), 2),
    COALESCE((SELECT recent_accuracy.trend FROM recent_accuracy), 'stable'),
    NOW()
  FROM uqs;
END;
$function$
;
