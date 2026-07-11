-- Vista de frescura de las tablas materializadas (pipeline outbox->handlers).
-- Motivo (incidente 11/07/2026): un falso positivo del canary gritó "materialización
-- no propaga" y costó ~1h diagnosticar que los usuarios REALES materializaban bien.
-- Parte del tiempo se perdió midiendo la columna EQUIVOCADA (last_attempt_at, que solo
-- se escribe en INSERT de fila nueva) en vez de updated_at (que avanza en cada UPDATE).
-- Esta vista fija la SEÑAL CANÓNICA (updated_at) y da un veredicto de 30 s:
--   SELECT * FROM v_materialization_health;   -- fresh=false → materialización parada
-- Es la MISMA fuente que RULE_MATERIALIZED_STATS_STALE. Ver docs/runbooks/materialization-health.md
CREATE OR REPLACE VIEW public.v_materialization_health AS
SELECT m.table_name,
       m.last_updated,
       ROUND(EXTRACT(EPOCH FROM (NOW() - m.last_updated)) / 60)::int AS lag_min,
       (m.last_updated > NOW() - INTERVAL '20 minutes')            AS fresh
FROM (
  SELECT 'user_question_history_v2' AS table_name, MAX(updated_at) AS last_updated FROM user_question_history_v2
  UNION ALL SELECT 'user_article_stats',    MAX(updated_at) FROM user_article_stats
  UNION ALL SELECT 'user_difficulty_stats', MAX(updated_at) FROM user_difficulty_stats
  UNION ALL SELECT 'user_daily_stats',      MAX(updated_at) FROM user_daily_stats
  UNION ALL SELECT 'user_hourly_stats',     MAX(updated_at) FROM user_hourly_stats
  UNION ALL SELECT 'user_stats_summary',    MAX(updated_at) FROM user_stats_summary
) m
ORDER BY lag_min DESC;

COMMENT ON VIEW public.v_materialization_health IS
  'Frescura de las tablas materializadas (pipeline outbox->handlers). updated_at = señal canonica (NO last_attempt_at, que solo se pone en INSERT). Ver docs/runbooks/materialization-health.md';
