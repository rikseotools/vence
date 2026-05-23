-- Migration: drift_cron_marker
-- 2026-05-23
--
-- Fix de diseño: la función check_stats_drift solo escribe a
-- stats_drift_log cuando encuentra drift. Si no hay drift (lo deseable),
-- el indicador "drift_cron stale_hours" del panel /admin/salud-sistema
-- diría rojo siempre porque MAX(checked_at) sería null.
--
-- Fix: la función ahora inserta UNA fila marker al final de cada
-- ejecución con target_table='__cron_run__' y notes='scan_complete:N'
-- donde N es el sample size. El indicador del panel lee
-- MAX(checked_at) WHERE target_table='__cron_run__' para el liveness check.
--
-- Las filas de drift reales (target_table = 'user_stats_summary' etc.)
-- se filtran por NOT target_table LIKE '__%' cuando se quieran consultar.

CREATE OR REPLACE FUNCTION check_stats_drift(p_sample_size INT DEFAULT 30)
RETURNS TABLE (
  checked INT,
  drifts_found INT,
  errors INT,
  duration_ms INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start TIMESTAMPTZ := clock_timestamp();
  v_user RECORD;
  v_checked INT := 0;
  v_drifts INT := 0;
  v_errors INT := 0;
  v_stored INT;
  v_fresh INT;
BEGIN
  FOR v_user IN
    SELECT s.user_id
    FROM user_stats_summary s
    WHERE s.total_questions > 0
      AND s.updated_at > NOW() - INTERVAL '30 days'
    ORDER BY random()
    LIMIT p_sample_size
  LOOP
    BEGIN
      -- 1) user_stats_summary.total_questions
      SELECT s.total_questions INTO v_stored
      FROM user_stats_summary s WHERE s.user_id = v_user.user_id;

      SELECT COUNT(*)::int INTO v_fresh
      FROM test_questions tq
      JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id;

      IF COALESCE(v_stored, 0) <> COALESCE(v_fresh, 0) THEN
        INSERT INTO stats_drift_log
          (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES
          ('user_stats_summary', v_user.user_id, 'total_questions', v_stored, v_fresh);
        v_drifts := v_drifts + 1;
      END IF;

      -- 2) user_stats_summary.correct_answers
      SELECT s.correct_answers INTO v_stored
      FROM user_stats_summary s WHERE s.user_id = v_user.user_id;

      SELECT COALESCE(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END), 0)::int INTO v_fresh
      FROM test_questions tq
      JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id;

      IF COALESCE(v_stored, 0) <> COALESCE(v_fresh, 0) THEN
        INSERT INTO stats_drift_log
          (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES
          ('user_stats_summary', v_user.user_id, 'correct_answers', v_stored, v_fresh);
        v_drifts := v_drifts + 1;
      END IF;

      -- 3) user_question_history_v2 row count
      SELECT COUNT(*)::int INTO v_stored
      FROM user_question_history_v2 WHERE user_id = v_user.user_id;

      SELECT COUNT(DISTINCT tq.question_id)::int INTO v_fresh
      FROM test_questions tq
      JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id AND tq.question_id IS NOT NULL;

      IF COALESCE(v_stored, 0) <> COALESCE(v_fresh, 0) THEN
        INSERT INTO stats_drift_log
          (target_table, user_id, field_name, stored_value, fresh_value, notes)
        VALUES
          ('user_question_history_v2', v_user.user_id, 'row_count',
           v_stored, v_fresh,
           'count(uqh_v2 rows) vs count(distinct question_id en test_questions)');
        v_drifts := v_drifts + 1;
      END IF;

      v_checked := v_checked + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO stats_drift_log
        (target_table, user_id, field_name, notes)
      VALUES
        ('__exception__', v_user.user_id, 'check_failed', SQLERRM);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Marker de "el cron corrió" — siempre se escribe, independientemente
  -- de los drifts encontrados. El indicador drift_cron del panel admin
  -- usa esto como liveness check (MAX(checked_at) WHERE target_table='__cron_run__').
  -- user_id es un placeholder (no aplica al marker pero la columna es NOT NULL).
  INSERT INTO stats_drift_log
    (target_table, user_id, field_name, stored_value, fresh_value, notes)
  VALUES
    ('__cron_run__', '00000000-0000-0000-0000-000000000000'::uuid,
     'scan_complete', v_checked, v_drifts,
     'sample_size=' || p_sample_size ||
     ' duration_ms=' || EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int ||
     ' errors=' || v_errors);

  RETURN QUERY SELECT
    v_checked,
    v_drifts,
    v_errors,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int;
END;
$$;
