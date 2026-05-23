-- Migration: stats_drift_log + check_stats_drift function
-- 2026-05-23
--
-- Observabilidad para tablas pre-agregadas (user_stats_summary,
-- user_question_history_v2, y las próximas user_difficulty_stats,
-- user_hourly_stats, user_article_stats, user_daily_stats del fix de
-- /api/stats).
--
-- Sin esta pieza, un bug en cualquier trigger de materialización
-- corrompe los contadores en silencio: el endpoint responde 200 con
-- números incorrectos durante días o semanas hasta que un usuario lo
-- nota. Sentry NO lo ve (no es excepción).
--
-- Cómo funciona:
--   1) Cron nocturno (4-6 AM Madrid) llama a check_stats_drift(50).
--   2) La función toma muestra aleatoria de 50 users con actividad
--      reciente y compara cada contador materializado vs fresh scan
--      de test_questions.
--   3) Si encuentra divergencia, escribe una fila en stats_drift_log
--      con el valor almacenado, el valor real, y los porcentajes.
--   4) El endpoint /api/cron/check-stats-drift agrega los resultados
--      y emite warning a Sentry si drift_pct > 5%.
--   5) El admin panel /admin/infraestructura → tab "Salud sistema"
--      muestra el resumen para que un humano lo mire en 30s.
--
-- Catálogo inicial de verificaciones (lo amplía el fix del /api/stats
-- cuando lleguen las 4 tablas nuevas):
--   - user_stats_summary.total_questions  vs COUNT(test_questions)
--   - user_stats_summary.correct_answers  vs SUM(is_correct)
--   - user_question_history_v2 row count  vs COUNT(DISTINCT question_id)
--
-- Cada verificación captura excepción por usuario para que un user roto
-- no rompa la pasada entera.

CREATE TABLE IF NOT EXISTS stats_drift_log (
  id BIGSERIAL PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  target_table TEXT NOT NULL,
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  stored_value NUMERIC,
  fresh_value NUMERIC,
  drift_abs NUMERIC GENERATED ALWAYS AS (
    ABS(COALESCE(stored_value, 0) - COALESCE(fresh_value, 0))
  ) STORED,
  drift_pct NUMERIC GENERATED ALWAYS AS (
    CASE
      WHEN fresh_value IS NULL OR fresh_value = 0 THEN NULL
      ELSE ROUND(
        ABS(COALESCE(stored_value, 0) - fresh_value) / ABS(fresh_value) * 100,
        2
      )
    END
  ) STORED,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS stats_drift_log_checked_at_desc
  ON stats_drift_log (checked_at DESC);

CREATE INDEX IF NOT EXISTS stats_drift_log_table_user
  ON stats_drift_log (target_table, user_id, checked_at DESC);

-- Solo filas con drift "significativo" — el cron las usa para emitir
-- warning a Sentry. Define el umbral en un solo sitio.
CREATE INDEX IF NOT EXISTS stats_drift_log_significant
  ON stats_drift_log (checked_at DESC)
  WHERE drift_pct > 5;

COMMENT ON TABLE stats_drift_log IS
  'Append-only. Cada fila es una divergencia detectada por el cron de drift entre un contador materializado y el fresh scan equivalente. Ver docs/runbooks/health-check.md.';

-- ════════════════════════════════════════════════════════════════════
-- Función principal
-- ════════════════════════════════════════════════════════════════════

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
  -- Selección: users con actividad últimos 30 días, muestra aleatoria.
  -- Tomamos del lado materializado (user_stats_summary) y no de tests
  -- porque queremos verificar EXACTAMENTE las filas que ya tienen
  -- contador. Si user_stats_summary no tiene fila para un user, eso
  -- también es drift (debería haberla por el trigger de init).
  FOR v_user IN
    SELECT s.user_id
    FROM user_stats_summary s
    WHERE s.total_questions > 0
      AND s.updated_at > NOW() - INTERVAL '30 days'
    ORDER BY random()
    LIMIT p_sample_size
  LOOP
    BEGIN
      -- ───────────────────────────────────────────────────────────
      -- Verificación 1: user_stats_summary.total_questions
      -- ───────────────────────────────────────────────────────────
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
          ('user_stats_summary', v_user.user_id, 'total_questions',
           v_stored, v_fresh);
        v_drifts := v_drifts + 1;
      END IF;

      -- ───────────────────────────────────────────────────────────
      -- Verificación 2: user_stats_summary.correct_answers
      -- ───────────────────────────────────────────────────────────
      SELECT s.correct_answers INTO v_stored
      FROM user_stats_summary s WHERE s.user_id = v_user.user_id;

      SELECT COALESCE(SUM(CASE WHEN tq.is_correct THEN 1 ELSE 0 END), 0)::int
      INTO v_fresh
      FROM test_questions tq
      JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id;

      IF COALESCE(v_stored, 0) <> COALESCE(v_fresh, 0) THEN
        INSERT INTO stats_drift_log
          (target_table, user_id, field_name, stored_value, fresh_value)
        VALUES
          ('user_stats_summary', v_user.user_id, 'correct_answers',
           v_stored, v_fresh);
        v_drifts := v_drifts + 1;
      END IF;

      -- ───────────────────────────────────────────────────────────
      -- Verificación 3: user_question_history_v2 row count
      -- (smoke test — el agregado por user, no por (user, question))
      -- ───────────────────────────────────────────────────────────
      SELECT COUNT(*)::int INTO v_stored
      FROM user_question_history_v2 WHERE user_id = v_user.user_id;

      SELECT COUNT(DISTINCT tq.question_id)::int INTO v_fresh
      FROM test_questions tq
      JOIN tests t ON t.id = tq.test_id
      WHERE t.user_id = v_user.user_id
        AND tq.question_id IS NOT NULL;

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
      -- Un user roto no rompe la pasada. Lo registramos como error.
      INSERT INTO stats_drift_log
        (target_table, user_id, field_name, notes)
      VALUES
        ('__exception__', v_user.user_id, 'check_failed', SQLERRM);
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT
    v_checked,
    v_drifts,
    v_errors,
    EXTRACT(MILLISECONDS FROM clock_timestamp() - v_start)::int;
END;
$$;

COMMENT ON FUNCTION check_stats_drift IS
  'Compara una muestra aleatoria de contadores materializados vs fresh scan. Escribe divergencias en stats_drift_log. Llamado por /api/cron/check-stats-drift nocturno.';

-- Permisos: la función es SECURITY DEFINER y NO se debe exponer al rol
-- anon. Solo el role de service y la API server-side la invocan.
REVOKE EXECUTE ON FUNCTION check_stats_drift(INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION check_stats_drift(INT) FROM anon;
GRANT EXECUTE ON FUNCTION check_stats_drift(INT) TO service_role;
