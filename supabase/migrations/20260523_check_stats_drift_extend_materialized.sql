-- Migration: extend check_stats_drift with the 4 new materialized tables
-- 2026-05-23
--
-- La función check_stats_drift verificaba 3 cosas (user_stats_summary
-- total_questions/correct_answers + user_question_history_v2 row count).
-- Tras añadir las 4 tablas materializadas del fix de /api/stats
-- (user_difficulty_stats, user_hourly_stats, user_article_stats,
-- user_daily_stats) más las 2 columnas extendidas en user_stats_summary
-- (total_tests, total_time_seconds), el cron debe vigilar también esas
-- nuevas. Sin esta extensión, un bug en alguno de los 16 triggers
-- nuevos corrompería contadores en silencio y nadie se enteraría hasta
-- el siguiente reporte de usuario.
--
-- Verifica por user (mismo patrón de muestra aleatoria):
--   - user_stats_summary.total_tests     vs COUNT tests is_completed
--   - user_stats_summary.total_time_seconds vs SUM tq.time_spent
--   - user_difficulty_stats               vs aggregate por difficulty
--   - user_hourly_stats                   vs aggregate por hour
--   - user_article_stats                  vs aggregate por dim
--   - user_daily_stats                    vs aggregate por day
--
-- IMPORTANTE: t_cutoff debe respetar el `t0` del backfill mientras dicho
-- backfill esté en curso, para evitar falsos positivos. La función
-- toma como t_cutoff `min(NOW(), backfill_t0)` si existe marcador de
-- backfill activo; si no, NOW(). Una vez backfill completo, t0 deja de
-- usarse y la función filtra hasta NOW().
--
-- Rollback:
--   CREATE OR REPLACE FUNCTION check_stats_drift ... (cuerpo previo de
--   20260523_drift_cron_marker.sql)

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
  v_stored_int INT;
  v_fresh_int INT;
  v_stored_big BIGINT;
  v_fresh_big BIGINT;
  v_dim RECORD;
  v_t_cutoff TIMESTAMPTZ;
  v_backfill_t0 TIMESTAMPTZ;
BEGIN
  -- Detectar si hay backfill activo (presencia de marcador en la
  -- tabla auxiliar). Si lo hay, usar su t0 como cutoff superior — las
  -- tablas materializadas solo reflejan datos < t0 hasta que termine
  -- el backfill; comparar con todo test_questions daría falsos
  -- positivos durante el progreso.
  BEGIN
    SELECT (p.stats->>'t0')::TIMESTAMPTZ INTO v_backfill_t0
    FROM backfill_materialized_stats_progress p
    WHERE p.user_id = '00000000-0000-0000-0000-000000000000'::uuid
      AND p.stats->>'role' = 'backfill_start_marker';
  EXCEPTION WHEN OTHERS THEN
    v_backfill_t0 := NULL;  -- tabla no existe → no hay backfill, OK
  END;

  -- Si el backfill terminó (todos los users tienen fila en progress),
  -- ignoramos t0 y usamos NOW(). Detección: si quedan pendientes,
  -- estamos en backfill.
  IF v_backfill_t0 IS NOT NULL THEN
    DECLARE
      v_pending INT;
    BEGIN
      SELECT COUNT(*)::INT INTO v_pending
      FROM tests t
      WHERE t.user_id IS NOT NULL
        AND t.created_at < v_backfill_t0
        AND NOT EXISTS (
          SELECT 1 FROM backfill_materialized_stats_progress p
          WHERE p.user_id = t.user_id
        );
      IF v_pending = 0 THEN
        v_backfill_t0 := NULL;  -- backfill completo, libera el cutoff
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_backfill_t0 := NULL;
    END;
  END IF;

  v_t_cutoff := COALESCE(v_backfill_t0, NOW());

  FOR v_user IN
    SELECT s.user_id
    FROM user_stats_summary s
    WHERE s.total_questions > 0
      AND s.updated_at > NOW() - INTERVAL '30 days'
    ORDER BY random()
    LIMIT p_sample_size
  LOOP
    BEGIN
      -- ──────────────────────────────────────────────────────────
      -- 1) user_stats_summary.total_questions
      -- ──────────────────────────────────────────────────────────
      SELECT s.total_questions INTO v_stored_int
      FROM user_stats_summary s WHERE s.user_id = v_user.user_id;
      SELECT COUNT(*)::int INTO v_fresh_int
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id AND tq.created_at < v_t_cutoff;
      IF COALESCE(v_stored_int, 0) <> COALESCE(v_fresh_int, 0) THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_stats_summary', v_user.user_id, 'total_questions', v_stored_int, v_fresh_int);
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 2) user_stats_summary.correct_answers
      -- ──────────────────────────────────────────────────────────
      SELECT s.correct_answers INTO v_stored_int
      FROM user_stats_summary s WHERE s.user_id = v_user.user_id;
      SELECT COALESCE(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END), 0)::int INTO v_fresh_int
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id AND tq.created_at < v_t_cutoff;
      IF COALESCE(v_stored_int, 0) <> COALESCE(v_fresh_int, 0) THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_stats_summary', v_user.user_id, 'correct_answers', v_stored_int, v_fresh_int);
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 3) user_stats_summary.total_tests (NUEVO)
      -- ──────────────────────────────────────────────────────────
      SELECT s.total_tests INTO v_stored_int
      FROM user_stats_summary s WHERE s.user_id = v_user.user_id;
      SELECT COUNT(*)::int INTO v_fresh_int
      FROM tests t
      WHERE t.user_id = v_user.user_id AND t.is_completed = true
        AND t.created_at < v_t_cutoff;
      IF COALESCE(v_stored_int, 0) <> COALESCE(v_fresh_int, 0) THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_stats_summary', v_user.user_id, 'total_tests', v_stored_int, v_fresh_int);
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 4) user_stats_summary.total_time_seconds (NUEVO)
      -- ──────────────────────────────────────────────────────────
      SELECT s.total_time_seconds INTO v_stored_big
      FROM user_stats_summary s WHERE s.user_id = v_user.user_id;
      SELECT COALESCE(SUM(tq.time_spent_seconds), 0)::bigint INTO v_fresh_big
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id AND tq.created_at < v_t_cutoff;
      IF COALESCE(v_stored_big, 0) <> COALESCE(v_fresh_big, 0) THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_stats_summary', v_user.user_id, 'total_time_seconds', v_stored_big, v_fresh_big);
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 5) user_question_history_v2 row count
      -- ──────────────────────────────────────────────────────────
      SELECT COUNT(*)::int INTO v_stored_int
      FROM user_question_history_v2 WHERE user_id = v_user.user_id;
      SELECT COUNT(DISTINCT tq.question_id)::int INTO v_fresh_int
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id AND tq.question_id IS NOT NULL;
      IF COALESCE(v_stored_int, 0) <> COALESCE(v_fresh_int, 0) THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value, notes)
        VALUES ('user_question_history_v2', v_user.user_id, 'row_count',
                v_stored_int, v_fresh_int,
                'count(uqh_v2 rows) vs count(distinct question_id en test_questions)');
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 6) user_difficulty_stats sum (NUEVO)
      -- Verifica la SUMA total por user; si individual difficulty
      -- diverge, también lo hará la suma. Detección más barata que
      -- recorrer cada difficulty separado.
      -- ──────────────────────────────────────────────────────────
      SELECT COALESCE(SUM(total_questions), 0)::int INTO v_stored_int
      FROM user_difficulty_stats WHERE user_id = v_user.user_id;
      SELECT COUNT(*)::int INTO v_fresh_int
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id
        AND tq.difficulty IN ('easy','medium','hard','extreme')
        AND tq.created_at < v_t_cutoff;
      IF v_stored_int <> v_fresh_int THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_difficulty_stats', v_user.user_id, 'sum_total_questions', v_stored_int, v_fresh_int);
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 7) user_hourly_stats sum (NUEVO)
      -- ──────────────────────────────────────────────────────────
      SELECT COALESCE(SUM(total_questions), 0)::int INTO v_stored_int
      FROM user_hourly_stats WHERE user_id = v_user.user_id;
      SELECT COUNT(*)::int INTO v_fresh_int
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id AND tq.created_at < v_t_cutoff;
      IF v_stored_int <> v_fresh_int THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_hourly_stats', v_user.user_id, 'sum_total_questions', v_stored_int, v_fresh_int);
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 8) user_article_stats sum (NUEVO) — solo article_number IS NOT NULL
      -- ──────────────────────────────────────────────────────────
      SELECT COALESCE(SUM(total_questions), 0)::int INTO v_stored_int
      FROM user_article_stats WHERE user_id = v_user.user_id;
      SELECT COUNT(*)::int INTO v_fresh_int
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id
        AND tq.article_number IS NOT NULL
        AND tq.created_at < v_t_cutoff;
      IF v_stored_int <> v_fresh_int THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_article_stats', v_user.user_id, 'sum_total_questions', v_stored_int, v_fresh_int);
        v_drifts := v_drifts + 1;
      END IF;

      -- ──────────────────────────────────────────────────────────
      -- 9) user_daily_stats sum (NUEVO)
      -- ──────────────────────────────────────────────────────────
      SELECT COALESCE(SUM(total_questions), 0)::int INTO v_stored_int
      FROM user_daily_stats WHERE user_id = v_user.user_id;
      SELECT COUNT(*)::int INTO v_fresh_int
      FROM test_questions tq JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id AND tq.created_at < v_t_cutoff;
      IF v_stored_int <> v_fresh_int THEN
        INSERT INTO stats_drift_log (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES ('user_daily_stats', v_user.user_id, 'sum_total_questions', v_stored_int, v_fresh_int);
        v_drifts := v_drifts + 1;
      END IF;

      v_checked := v_checked + 1;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO stats_drift_log (target_table, user_id, field_name, notes)
      VALUES ('__exception__', v_user.user_id, 'check_failed', SQLERRM);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  -- Marker de "el cron corrió"
  INSERT INTO stats_drift_log
    (target_table, user_id, field_name, stored_value, fresh_value, notes)
  VALUES
    ('__cron_run__', '00000000-0000-0000-0000-000000000000'::uuid,
     'scan_complete', v_checked, v_drifts,
     'sample_size=' || p_sample_size ||
     ' duration_ms=' || EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int ||
     ' errors=' || v_errors ||
     ' t_cutoff=' || v_t_cutoff::text ||
     ' (backfill_active=' || (CASE WHEN v_backfill_t0 IS NOT NULL THEN 'yes' ELSE 'no' END) || ')');

  RETURN QUERY SELECT
    v_checked,
    v_drifts,
    v_errors,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int;
END;
$$;

COMMENT ON FUNCTION check_stats_drift IS
  'Versión 2026-05-23: extendida con las 4 tablas materializadas del fix /api/stats + 2 columnas nuevas en user_stats_summary. Respeta backfill activo usando t0 del marcador.';
