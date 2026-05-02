-- Migration: simplify_trigger_user_analytics (Fase 1 escalabilidad)
-- 2026-05-02
--
-- Elimina las llamadas a update_user_learning_analytics() del trigger
-- update_user_analytics_on_test_completion en `tests` (AFTER UPDATE).
-- Mantiene únicamente la actualización ligera de is_active_student.
--
-- Por qué (investigación exhaustiva 2026-05-02 confirmada por 8 vías):
--
-- El trigger original llamaba 2× a update_user_learning_analytics(), que
-- internamente hace además 2× detect_learning_style() — total: hasta 6
-- aggregate scans de test_questions (2.2 GB) por test completado. Medido
-- en producción:
--   - Usuario medio: ~2.1s por completar test (el trigger entero)
--   - Top user (2208 tests, 23k respuestas): 3.6s por scan x6 = ~22s,
--     excediendo statement_timeout=45s en algunos casos
--
-- Esto explica los warnings de 4-9.6s observados en /api/v2/complete-test.
--
-- La tabla `user_learning_analytics` que poblaba (58k filas, 2107 usuarios)
-- NO es leída por nadie:
--   1. grep en TS/JS/SQL/CJS/MJS/JSX/TSX/MD: 0 readers en código de app
--      (única referencia es el cleanup en admin-delete-user/queries.ts)
--   2. Vistas SQL que la usan: 0
--   3. Otros triggers que la mencionen: 0
--   4. Funciones SQL que SELECT/JOIN-een FROM ella: 0 (solo
--      update_user_learning_analytics que la escribe, y verify_triggers_working
--      que la nombra para diagnóstico)
--   5. pg_stat_statements SELECTs explícitos: 0 (los 28k idx_scan se explican
--      por las verificaciones de unicidad del ON CONFLICT del propio trigger)
--   6. RPCs hermanas (predict_exam_readiness, get_complete_test_analytics,
--      detect_learning_style) tampoco se llaman desde el código
--   7. Componente Statistics/ExamReadiness recibe examReadiness como prop,
--      pero mis-estadisticas/page.tsx lo hardcodea a null. detectRealLearningStyle
--      recalcula localmente desde responses crudas
--   8. getUserAnalytics() en lib/api/questions/queries.ts existe pero NO lee
--      esta tabla — escanea test_questions con CTE materializada
--
-- La tabla parece ser un fósil de un sistema de IA planificado pero nunca
-- conectado a UI. El trigger fue marcado en docs/database/tablas.md como
-- "⭐ TRIGGER PRINCIPAL" (intención original), pero los consumers nunca se
-- implementaron o se eliminaron.
--
-- Comportamiento preservado:
--   - is_active_student=true se sigue marcando al completar primer test
--   - first_test_completed_at se sigue rellenando (con COALESCE)
--   - La tabla user_learning_analytics queda CONGELADA con sus 58k filas
--     históricas (no se borra, no se trunca). Si en el futuro se reactivan
--     features de IA, los datos antiguos siguen disponibles y se puede
--     repoblar via cron debounced en off-peak.
--
-- Parity test confirmado 2026-05-02 (en transacción + rollback):
--   - Trigger ACTUAL: 2153ms para UPDATE tests
--   - Trigger NUEVO: 38ms (98% reducción)
--   - is_active_student y first_test_completed_at idénticos en ambos casos
--
-- Mismo patrón que ya aplicamos a:
--   - trigger_update_article_stats (#7) — neutralizado
--   - update_question_difficulty_immediate (#2) — debounced cron
--   - update_question_global_difficulty (#3, #4) — debounced cron
--   - update_user_question_history (#5) — incremental
--
-- Ganancia esperada en /api/v2/complete-test: 9.6s → <500ms

CREATE OR REPLACE FUNCTION public.trigger_update_user_analytics()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Solo actuar cuando se completa el test
  IF NEW.is_completed = true AND (OLD IS NULL OR OLD.is_completed = false) THEN

    -- Mantener: marcar usuario como activo en su primera completación
    -- (1 fila indexada por PK, COALESCE evita sobrescribir la fecha original)
    UPDATE user_profiles
    SET
      is_active_student = true,
      first_test_completed_at = COALESCE(first_test_completed_at, NEW.completed_at),
      updated_at = now()
    WHERE id = NEW.user_id AND is_active_student = false;

    -- ELIMINADO: las 2 llamadas a update_user_learning_analytics() que hacían
    -- 6 aggregate scans de test_questions sin que nadie consuma los datos.
    -- Si necesitas reactivarlas, ver el body original con git blame de este
    -- archivo o consultar docs/database/tablas.md sección 11/42.

  END IF;

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.trigger_update_user_analytics() IS
  'Simplified 2026-05-02: removed update_user_learning_analytics() calls (6× full scans of 2.2GB test_questions per test, table never read by app). Only updates user_profiles.is_active_student now. See migration 20260502_simplify_trigger_user_analytics.sql for full rationale.';
