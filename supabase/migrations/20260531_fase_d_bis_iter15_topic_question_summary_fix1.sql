-- Fix #1 de la migration Iter 1.5: LEFT JOIN questions mete filas con q.id=NULL
-- en los COUNT(*) FILTER, sumándolas erróneamente al bucket 'auto'.
-- Cambio: usar COUNT(q.id) (solo non-null) en lugar de COUNT(*).
-- También para articles_with_questions: usar COUNT(DISTINCT a.id) con filter q.id NOT NULL
-- ya estaba correcto; verificado en test.
--
-- Detectado por test de paridad — topic 0001eb8d (4 articles sin questions
-- caían en count_auto cuando JS los excluye porque processDifficultyStats
-- itera solo questions reales, no articles vacíos).

DROP MATERIALIZED VIEW IF EXISTS topic_law_question_summary CASCADE;

CREATE MATERIALIZED VIEW topic_law_question_summary AS
SELECT
  ts.topic_id,
  ts.law_id,
  l.short_name           AS law_short_name,
  l.name                 AS law_name,
  COUNT(q.id)::int       AS total_questions,
  COUNT(DISTINCT a.id) FILTER (WHERE q.id IS NOT NULL)::int AS articles_with_questions,
  COUNT(q.id) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'easy')::int    AS count_easy,
  COUNT(q.id) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'medium')::int  AS count_medium,
  COUNT(q.id) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'hard')::int    AS count_hard,
  COUNT(q.id) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'extreme')::int AS count_extreme,
  COUNT(q.id) FILTER (WHERE topic_question_difficulty_bucket(q.global_difficulty, q.difficulty) = 'auto')::int    AS count_auto,
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

CREATE UNIQUE INDEX topic_law_question_summary_pk
  ON topic_law_question_summary (topic_id, law_id);
CREATE INDEX topic_law_question_summary_topic_idx
  ON topic_law_question_summary (topic_id);

COMMENT ON MATERIALIZED VIEW topic_law_question_summary IS
  'Fase D-bis Iter 1.5 — agregados pre-calculados por (topic_id, law_id) '
  'para getTopicFullData. Refresh nightly + on-demand admin. '
  'Fix #1 31/05/2026: COUNT(q.id) en vez de COUNT(*) para no contar las filas '
  'con q.id=NULL del LEFT JOIN questions en el bucket auto.';
