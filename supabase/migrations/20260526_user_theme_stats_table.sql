-- Migration: user_theme_stats_table
-- 2026-05-26
--
-- Fase 1 del roadmap docs/roadmap/materialized-stats-aggregates.md.
-- Crea la tabla materializada que reemplazará el agregado en runtime de
-- /api/v2/topic-progress/theme-stats — actualmente 10-12s para users
-- heavy (>30k test_questions) que dispara el timeout 10s del endpoint
-- y sirve stale silenciosamente.
--
-- Esta migración SOLO crea la tabla con su PK + índice. Las piezas
-- complementarias van en migraciones separadas:
--   - Triggers:  20260526_user_theme_stats_triggers.sql (Fase 1 — siguiente)
--   - Backfill:  scripts/backfill-user-theme-stats.mjs    (Fase 1 — siguiente)
--   - Drift:     20260527_check_user_theme_stats_drift.sql (Fase 2)
--   - Endpoint:  app/api/v2/topic-progress/theme-stats/route.ts (Fase 3)
--
-- Diseño completo + tradeoffs + endpoints futuros → ver
-- docs/roadmap/materialized-stats-aggregates.md.
--
-- Rollback (5 segundos):
--   DROP TABLE IF EXISTS user_theme_stats;
--
-- Tras aplicar, la tabla existe vacía. Ningún endpoint la lee aún.
-- Los lectores actuales (theme-stats route, query directa sobre
-- test_questions) siguen funcionando sin cambios.

-- ════════════════════════════════════════════════════════════════════
-- Tabla user_theme_stats
-- ════════════════════════════════════════════════════════════════════
--
-- Modelo: 1 fila por (usuario, oposición, tema). Counters lifetime
-- (total, correct, last_study) mantenidos por triggers AFTER
-- INSERT/UPDATE/DELETE sobre test_questions. Sliding window 30d NO se
-- materializa aquí — se calcula en el endpoint con query secundaria
-- ligera sobre test_questions con índice (user_id, tema_number,
-- created_at). Razón: ventana móvil mal modelada con triggers; query
-- 30d con índice es <10ms vs los 12s del agregado completo.
--
-- PK compuesta para UPSERT en triggers. Índice secundario (user_id,
-- position_type) cubre el patrón de lectura del endpoint, que pide
-- todas las temas de un usuario para una oposición concreta.

CREATE TABLE IF NOT EXISTS user_theme_stats (
  user_id        uuid NOT NULL,
  position_type  text NOT NULL,
  tema_number    int NOT NULL,
  total          int NOT NULL DEFAULT 0,
  correct        int NOT NULL DEFAULT 0,
  last_study     timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, position_type, tema_number)
);

-- Índice para el patrón de lectura del endpoint:
-- SELECT * FROM user_theme_stats WHERE user_id = ? AND position_type = ?
-- (lee todos los temas del usuario para una oposición concreta).
CREATE INDEX IF NOT EXISTS idx_user_theme_stats_user_position
  ON user_theme_stats (user_id, position_type);

-- Comentarios para discoverability futura.
COMMENT ON TABLE user_theme_stats IS
  'Counters lifetime (total/correct/last_study) por (user, oposición, tema). '
  'Mantenida por triggers en test_questions. Lectura sub-50ms vía PK lookup. '
  'Slice 30d NO está aquí — se calcula en runtime con query separada. '
  'Roadmap: docs/roadmap/materialized-stats-aggregates.md.';

COMMENT ON COLUMN user_theme_stats.total IS
  'Total de preguntas respondidas en este tema (lifetime).';

COMMENT ON COLUMN user_theme_stats.correct IS
  'Total de respuestas correctas en este tema (lifetime).';

COMMENT ON COLUMN user_theme_stats.last_study IS
  'Timestamp de la última respuesta en este tema. Para ordenar "actividad reciente".';

COMMENT ON COLUMN user_theme_stats.updated_at IS
  'Timestamp del último cambio en esta fila (set por triggers). '
  'Usado por drift detection para identificar filas stale.';
