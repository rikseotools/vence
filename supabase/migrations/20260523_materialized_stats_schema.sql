-- Migration: materialized_stats_schema
-- 2026-05-23
--
-- Fix de fondo de /api/stats (incidente 22/05). Crea las 5 tablas
-- materializadas que el endpoint reescrito leerá por lookup PK en vez
-- de escanear test_questions. Esta migración NO crea triggers ni hace
-- backfill — son piezas separadas:
--   - Triggers: migración 20260524_materialized_stats_triggers.sql (task #5)
--   - Backfill: scripts/backfill-materialized-stats.mjs (task #5)
--   - Reescritura queries: task #6
--   - Cutover canary: task #8
--
-- Diseño completo + razonamiento + validaciones contra producción → ver
-- docs/ARCHITECTURE_ROADMAP.md → sección "ADR triggers SQL vs outbox/worker".
--
-- Rollback (5 segundos por tabla):
--   ALTER TABLE user_stats_summary DROP COLUMN total_tests, DROP COLUMN total_time_seconds;
--   DROP TABLE user_difficulty_stats;
--   DROP TABLE user_hourly_stats;
--   DROP TABLE user_article_stats;
--   DROP TABLE user_daily_stats;
--
-- Tras aplicar, las tablas existen pero están VACÍAS. Los readers viejos
-- (lib/api/stats/queries.ts actual) siguen funcionando porque escanean
-- test_questions; los nuevos esperan a backfill + triggers.

-- ════════════════════════════════════════════════════════════════════
-- 1) user_stats_summary — EXTENDER con 2 columnas
-- ════════════════════════════════════════════════════════════════════
--
-- total_tests: incrementado por trigger sobre `tests` AFTER UPDATE OF
--   is_completed con WHEN guard (+1 si false→true, -1 si true→false).
--   1.046 tests con is_completed=false AND completed_at IS NOT NULL en
--   producción confirman que el toggle bidireccional es necesario.
--
-- total_time_seconds: incrementado por trigger sobre `test_questions`
--   (INSERT/UPDATE de time_spent_seconds/DELETE). Mantener desde
--   test_questions evita la divergencia 200% con tests.total_time_seconds
--   (medida en producción 23/05; tests.total_time incluye tiempo muerto
--   entre preguntas, la suma de test_questions solo cuenta tiempo de
--   responder).
--
-- best_score_percent: NO se materializa. Es MAX, no contador — no se
--   puede mantener incrementalmente (un test que baja requiere recalcular).
--   Coste medido: 2.6ms en BD (EXPLAIN ANALYZE Bitmap Index Scan idx_tests_user_completed).
--   Se calcula ad-hoc en getMainStats reescrito.

ALTER TABLE user_stats_summary
  ADD COLUMN IF NOT EXISTS total_tests INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_time_seconds BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN user_stats_summary.total_tests IS
  'Tests completados (is_completed=true). Mantenido por trigger sobre tests con WHEN guard. NO usar para inferir tests pendientes — la columna es delta acumulado, no live count.';

COMMENT ON COLUMN user_stats_summary.total_time_seconds IS
  'SUM(test_questions.time_spent_seconds) — coincide con la query original de getMainStats. NO usar SUM(tests.total_time_seconds) — diverge 200%.';

-- ════════════════════════════════════════════════════════════════════
-- 2) user_difficulty_stats — agrupado por (user_id, difficulty)
-- ════════════════════════════════════════════════════════════════════
--
-- Distribución real de difficulty en test_questions (medida 23/05):
--   medium: 832k (68%), easy: 295k (24%), hard: 75k (6%), extreme: 5k (0.4%)
-- Max 4 filas por user. Volumen total esperado: ~18k filas.

CREATE TABLE IF NOT EXISTS user_difficulty_stats (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy','medium','hard','extreme')),
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  total_time_seconds BIGINT NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, difficulty)
);

COMMENT ON TABLE user_difficulty_stats IS
  'Pre-agregado para getDifficultyBreakdown en /api/stats. Mantenido por trigger sobre test_questions INSERT/UPDATE de is_correct/DELETE. Lookup por (user_id, difficulty) en <1ms vs scan de test_questions con GROUP BY.';

-- ════════════════════════════════════════════════════════════════════
-- 3) user_hourly_stats — agrupado por (user_id, hour 0-23 Europe/Madrid)
-- ════════════════════════════════════════════════════════════════════
--
-- 24 filas por user. Volumen total esperado: ~110k filas.
-- La query original usa EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Madrid')
-- — mantenemos misma zona horaria para que los números coincidan.

CREATE TABLE IF NOT EXISTS user_hourly_stats (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  hour SMALLINT NOT NULL CHECK (hour BETWEEN 0 AND 23),
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, hour)
);

COMMENT ON TABLE user_hourly_stats IS
  'Pre-agregado para getTimePatterns.hourlyDistribution en /api/stats. hour es 0-23 en zona Europe/Madrid (igual que la query original).';

-- ════════════════════════════════════════════════════════════════════
-- 4) user_article_stats — agrupado por dimensiones del artículo
-- ════════════════════════════════════════════════════════════════════
--
-- La query original agrupa por (article_id, article_number, law_name, tema_number).
-- article_id puede ser NULL (preguntas legacy sin vincular). Para
-- mantener la misma semántica que el GROUP BY actual (que trata NULL
-- como valor distinto en cada combinación), usamos surrogate PK
-- BIGSERIAL + UNIQUE INDEX con NULLS NOT DISTINCT (PG15+, validado en
-- PG 17.4 con UPSERT fila-por-fila).
--
-- Cardinalidad real (medida 23/05): heavy user 1.591 artículos
-- distintos. Volumen total esperado: ~1-2M filas (sobre 4.6k users
-- activos con test_questions article_number not null).

CREATE TABLE IF NOT EXISTS user_article_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  article_id UUID,            -- NULL permitido
  article_number TEXT,        -- NULL permitido
  law_name TEXT,              -- NULL permitido
  tema_number INTEGER,        -- NULL permitido
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index para UPSERT con ON CONFLICT desde el trigger.
-- NULLS NOT DISTINCT (PG15+) trata todas las NULLs como iguales en este
-- índice — esencial para que un user con article_id=NULL no genere una
-- fila nueva por cada respuesta.
CREATE UNIQUE INDEX IF NOT EXISTS user_article_stats_dim_uniq
  ON user_article_stats (user_id, article_id, article_number, law_name, tema_number)
  NULLS NOT DISTINCT;

-- Acelera el ORDER BY accuracy del query original (que filtra count>=2).
-- Índice parcial sobre la expresión calculada — Postgres usa este
-- índice cuando query tiene WHERE total_questions >= 2 ORDER BY ratio.
CREATE INDEX IF NOT EXISTS user_article_stats_user_acc_idx
  ON user_article_stats (user_id, (correct_answers::float / NULLIF(total_questions, 0)) ASC)
  WHERE total_questions >= 2;

COMMENT ON TABLE user_article_stats IS
  'Pre-agregado para getArticleStats en /api/stats. Surrogate PK porque las dimensiones pueden contener NULL. UNIQUE INDEX NULLS NOT DISTINCT mantiene la semántica del GROUP BY original (NULLs colapsan a una sola fila por user).';

-- ════════════════════════════════════════════════════════════════════
-- 5) user_daily_stats — agrupado por (user_id, day Europe/Madrid)
-- ════════════════════════════════════════════════════════════════════
--
-- Para getWeeklyProgress (últimos 30 días) — añadido al alcance del fix
-- por simetría: también full-scaneaba test_questions con GROUP BY DATE.
-- ~365 filas/user. Volumen total esperado: ~1.7M filas a largo plazo.
-- Sin política de retención inicial — se añade cron de purga >90 días
-- si el volumen crece feo.

CREATE TABLE IF NOT EXISTS user_daily_stats (
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  total_time_seconds BIGINT NOT NULL DEFAULT 0 CHECK (total_time_seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, day)
);

-- getWeeklyProgress pide últimos 30 días con ORDER BY date.
-- Índice (user_id, day DESC) sirve el query sin sort.
CREATE INDEX IF NOT EXISTS user_daily_stats_user_day_desc
  ON user_daily_stats (user_id, day DESC);

COMMENT ON TABLE user_daily_stats IS
  'Pre-agregado para getWeeklyProgress en /api/stats. day en zona Europe/Madrid. Sin política de retención automática inicial.';

-- ════════════════════════════════════════════════════════════════════
-- Verificación post-aplicación: las 5 tablas existen + columnas nuevas
-- ════════════════════════════════════════════════════════════════════
DO $verify$
DECLARE
  v_count INT;
BEGIN
  -- Tablas
  SELECT COUNT(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'user_difficulty_stats', 'user_hourly_stats',
      'user_article_stats', 'user_daily_stats'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'ABORT: esperaba 4 tablas nuevas, hay %', v_count;
  END IF;

  -- Columnas nuevas en user_stats_summary
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_stats_summary'
    AND column_name IN ('total_tests', 'total_time_seconds');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ABORT: esperaba 2 columnas nuevas en user_stats_summary, hay %', v_count;
  END IF;

  -- UNIQUE NULLS NOT DISTINCT en user_article_stats
  SELECT COUNT(*) INTO v_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname = 'user_article_stats_dim_uniq';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'ABORT: índice user_article_stats_dim_uniq no se creó';
  END IF;

  RAISE NOTICE 'Schema verificado: 5 tablas (1 extendida + 4 nuevas), índices OK';
END;
$verify$;

-- Permisos: las tablas son sensibles (datos personales agregados). Solo
-- service_role escribe (vía triggers + backfill). Lectura desde la app
-- pasa por endpoints autenticados (no PostgREST directo).
REVOKE ALL ON user_difficulty_stats FROM PUBLIC;
REVOKE ALL ON user_difficulty_stats FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_difficulty_stats TO service_role;

REVOKE ALL ON user_hourly_stats FROM PUBLIC;
REVOKE ALL ON user_hourly_stats FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_hourly_stats TO service_role;

REVOKE ALL ON user_article_stats FROM PUBLIC;
REVOKE ALL ON user_article_stats FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_article_stats TO service_role;
GRANT USAGE, SELECT ON SEQUENCE user_article_stats_id_seq TO service_role;

REVOKE ALL ON user_daily_stats FROM PUBLIC;
REVOKE ALL ON user_daily_stats FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_daily_stats TO service_role;
