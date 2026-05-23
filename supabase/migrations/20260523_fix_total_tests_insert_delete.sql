-- Fix del bug detectado por el cron de drift 2026-05-23 ~17:34 CEST:
--
-- El trigger original (migración 20260523_materialized_stats_triggers.sql,
-- TRIGGER 1) cubría únicamente AFTER UPDATE OF is_completed sobre tests.
-- No cubría:
--   (a) INSERT con is_completed=true desde el principio — flujo del modo
--       examen / simulacro que persiste el test ya finalizado en un
--       único INSERT. Censo: 3.237 tests históricos, 14 hoy.
--   (b) DELETE de tests is_completed=true — admin borrando registros
--       fraudulentos, GDPR delete cascada. Raro pero posible.
--
-- Síntoma observado: 6 users con user_stats_summary.total_tests < real
-- COUNT(*) de tests completados (off-by-one).
--
-- Solución:
--   1. Función trigger reescrita para los 3 TG_OPs (INSERT / UPDATE OF
--      is_completed / DELETE). Patrón consistente con los demás triggers
--      de la migración base (total_time, difficulty, hourly, article,
--      daily).
--   2. UPSERT en lugar de UPDATE simple — resistente al orden de eventos
--      (INSERT en tests puede ocurrir antes del primer test_question que
--      sería quien crearía la fila en user_stats_summary).
--   3. Tres triggers separados (uno por TG_OP) con WHEN guards que
--      filtran los disparos irrelevantes en el motor antes de invocar la
--      función — coste mínimo en filas que no cambian is_completed.
--   4. Reconciliación one-shot al final, idempotente (solo toca filas
--      divergentes vía IS DISTINCT FROM).
--   5. Smoke verify que FALLA la migración si quedan drifts.
--
-- Idempotente: re-aplicar es seguro (DROP TRIGGER IF EXISTS + reconcile
-- es no-op cuando todo cuadra).

-- ════════════════════════════════════════════════════════════════════
-- 1) Función robusta para los 3 TG_OPs
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_user_stats_total_tests()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_delta   INT := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- WHEN guard del trigger ya filtra (NEW.is_completed IS TRUE).
    -- Defensa redundante por si la función se llama directamente.
    IF NEW.is_completed IS NOT TRUE THEN RETURN NEW; END IF;
    v_user_id := NEW.user_id;
    v_delta   := 1;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_completed IS TRUE
       AND (OLD.is_completed IS NULL OR OLD.is_completed IS FALSE) THEN
      v_delta := 1;
    ELSIF OLD.is_completed IS TRUE
          AND (NEW.is_completed IS NULL OR NEW.is_completed IS FALSE) THEN
      v_delta := -1;
    ELSE
      RETURN NEW;  -- transición irrelevante
    END IF;
    v_user_id := NEW.user_id;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_completed IS NOT TRUE THEN RETURN OLD; END IF;
    v_user_id := OLD.user_id;
    v_delta   := -1;
  END IF;

  IF v_user_id IS NULL THEN
    RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- UPSERT: crea la fila si no existe. Mismo patrón que los demás
  -- triggers de la migración base (user_difficulty_stats, etc).
  INSERT INTO user_stats_summary (user_id, total_tests)
  VALUES (v_user_id, GREATEST(0, v_delta))
  ON CONFLICT (user_id) DO UPDATE SET
    total_tests = GREATEST(0, user_stats_summary.total_tests + v_delta),
    updated_at  = NOW();

  RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ════════════════════════════════════════════════════════════════════
-- 2) Recrear los triggers — uno por TG_OP, con WHEN guards
-- ════════════════════════════════════════════════════════════════════

-- Borrar cualquier trigger viejo del nombre legacy
DROP TRIGGER IF EXISTS update_user_stats_total_tests_trigger        ON tests;
DROP TRIGGER IF EXISTS update_user_stats_total_tests_insert_trigger ON tests;
DROP TRIGGER IF EXISTS update_user_stats_total_tests_update_trigger ON tests;
DROP TRIGGER IF EXISTS update_user_stats_total_tests_delete_trigger ON tests;

CREATE TRIGGER update_user_stats_total_tests_insert_trigger
  AFTER INSERT ON tests
  FOR EACH ROW
  WHEN (NEW.is_completed IS TRUE)
  EXECUTE FUNCTION update_user_stats_total_tests();

CREATE TRIGGER update_user_stats_total_tests_update_trigger
  AFTER UPDATE OF is_completed ON tests
  FOR EACH ROW
  WHEN (OLD.is_completed IS DISTINCT FROM NEW.is_completed)
  EXECUTE FUNCTION update_user_stats_total_tests();

CREATE TRIGGER update_user_stats_total_tests_delete_trigger
  AFTER DELETE ON tests
  FOR EACH ROW
  WHEN (OLD.is_completed IS TRUE)
  EXECUTE FUNCTION update_user_stats_total_tests();

-- ════════════════════════════════════════════════════════════════════
-- 3) Reconciliación one-shot — re-calcula total_tests para users con
--    divergencia (idempotente, solo toca lo necesario)
-- ════════════════════════════════════════════════════════════════════

WITH fresh AS (
  SELECT user_id, COUNT(*)::int AS real_tests
  FROM tests
  WHERE is_completed = true
  GROUP BY user_id
),
-- Users con stats pero sin fila en fresh (ej. todos sus tests
-- des-completados) → debería ser 0
phantom AS (
  SELECT uss.user_id, 0 AS real_tests
  FROM user_stats_summary uss
  LEFT JOIN fresh f USING (user_id)
  WHERE f.user_id IS NULL AND uss.total_tests <> 0
),
target AS (
  SELECT * FROM fresh
  UNION ALL
  SELECT * FROM phantom
)
UPDATE user_stats_summary uss
SET total_tests = t.real_tests,
    updated_at  = NOW()
FROM target t
WHERE uss.user_id = t.user_id
  AND uss.total_tests IS DISTINCT FROM t.real_tests;

-- Asegurar que users con tests pero sin fila en user_stats_summary
-- también queden cubiertos (caso teórico — el trigger nuevo lo previene
-- en adelante, pero por defensa hacemos el INSERT aquí también)
INSERT INTO user_stats_summary (user_id, total_tests)
SELECT f.user_id, f.real_tests
FROM (
  SELECT user_id, COUNT(*)::int AS real_tests
  FROM tests
  WHERE is_completed = true
  GROUP BY user_id
) f
LEFT JOIN user_stats_summary uss USING (user_id)
WHERE uss.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════
-- 4) Smoke verify — FALLA la migración si queda algún drift
-- ════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_diverged INT;
BEGIN
  SELECT COUNT(*) INTO v_diverged
  FROM user_stats_summary uss
  LEFT JOIN (
    SELECT user_id, COUNT(*)::int AS real_tests
    FROM tests WHERE is_completed = true GROUP BY user_id
  ) fresh USING (user_id)
  WHERE uss.total_tests IS DISTINCT FROM COALESCE(fresh.real_tests, 0);

  IF v_diverged > 0 THEN
    RAISE EXCEPTION 'Reconciliación incompleta: % users siguen divergentes en total_tests', v_diverged;
  END IF;

  RAISE NOTICE 'Reconciliación OK: 0 users divergentes en user_stats_summary.total_tests';
END $$;
