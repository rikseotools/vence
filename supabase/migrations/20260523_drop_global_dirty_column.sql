-- Fase 2-bis paso 2/2 — DROP COLUMN questions.global_dirty
--
-- Cierre del trabajo iniciado en 20260517_drop_global_dirty_cron_system.sql
-- (paso 3 según el roadmap viejo). El sistema dirty-flag + cron quedó apagado
-- el 2026-05-17. La columna se mantuvo 6 días por margen de seguridad.
--
-- Pre-flight verificado el 2026-05-23 antes de aplicar:
--   1. 0 lecturas vivas en código (grep -r global_dirty descarta migraciones).
--   2. /api/admin/health (commit b1696f74) deployado en producción y respondiendo
--      200 OK sin leer la columna (validación activa, no soak por calendario).
--   3. 50 filas con global_dirty=true → las 50 tienen global_difficulty no-NULL
--      (trigger nuevo apply_first_attempt_to_question_stats las cubre).
--   4. Catálogo: la columna sólo cuelga del default `false` y del índice parcial
--      idx_questions_global_dirty. Ambos se llevan con DROP COLUMN ... CASCADE.
--   5. La función track_question_first_attempt sólo la menciona en un comentario
--      desde el paso 3 — no es código ejecutable. Esta migración limpia el
--      comentario para no dejar referencias huérfanas.
--
-- Rollback: si algo se rompe, restaurar columna con:
--   ALTER TABLE public.questions ADD COLUMN global_dirty BOOLEAN NOT NULL DEFAULT false;
--   CREATE INDEX idx_questions_global_dirty ON public.questions (id) WHERE global_dirty = true;
-- (las 50 filas dirty pre-drop quedan como false — no es regresión funcional
-- porque el trigger nuevo ya recalculó global_difficulty sin necesidad del flag).

BEGIN;

-- 1. DROP COLUMN + CASCADE para llevarse índice parcial y default
ALTER TABLE public.questions DROP COLUMN global_dirty CASCADE;

-- 2. Limpiar comentario huérfano en la función del trigger.
-- Cuerpo idéntico al de 20260517 pero sin el bloque "Eliminado UPDATE
-- questions SET global_dirty = true" que ya no aporta contexto.
CREATE OR REPLACE FUNCTION public.track_question_first_attempt()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id UUID;
  v_is_first_attempt BOOLEAN;
BEGIN
  -- Skip si psychometric o question_id null
  IF NEW.psychometric_question_id IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.question_id IS NULL THEN RETURN NEW; END IF;

  -- Resolver user_id desde tests (si NEW.user_id no está set)
  SELECT user_id INTO v_user_id FROM public.tests WHERE id = NEW.test_id;
  IF v_user_id IS NULL THEN RETURN NEW; END IF;

  -- Verificar primer intento (PK lookup, rápido con índice)
  SELECT NOT EXISTS (
    SELECT 1 FROM public.question_first_attempts
    WHERE user_id = v_user_id AND question_id = NEW.question_id
  ) INTO v_is_first_attempt;

  IF v_is_first_attempt THEN
    -- INSERT atómico. Dispara apply_first_attempt_to_question_stats_trigger
    -- que recalcula global_difficulty inmediato. Ver
    -- supabase/migrations/20260517_global_difficulty_robust_trigger.sql.
    INSERT INTO public.question_first_attempts (
      user_id, question_id, is_correct, time_spent_seconds, confidence_level, created_at
    ) VALUES (
      v_user_id, NEW.question_id, NEW.is_correct, NEW.time_spent_seconds,
      NEW.confidence_level, NOW()
    )
    ON CONFLICT (user_id, question_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Smoke verify dentro de la transacción
DO $$
DECLARE
  col_exists boolean;
  idx_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='questions' AND column_name='global_dirty'
  ) INTO col_exists;
  IF col_exists THEN
    RAISE EXCEPTION 'Smoke verify failed: column questions.global_dirty still exists';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_questions_global_dirty'
  ) INTO idx_exists;
  IF idx_exists THEN
    RAISE EXCEPTION 'Smoke verify failed: index idx_questions_global_dirty still exists';
  END IF;

  RAISE NOTICE 'Smoke verify OK: column + partial index dropped';
END $$;

COMMIT;
