-- Migration: lifecycle_phase_d_sync_trigger (Fase D, parte 1)
-- 2026-05-03
--
-- Roadmap completo: docs/roadmap/sistema-desactivacion-preguntas.md
--
-- ============================================================================
-- QUÉ HACE
-- ============================================================================
-- Crea trigger AFTER UPDATE OF lifecycle_state que sincroniza is_active
-- automáticamente. Cierra la ventana de desync entre fase B y fase E.
--
-- POR QUÉ AHORA Y NO EN FASE E
-- ============================================================================
-- Fase E convierte is_active en GENERATED column (la fórmula final, enforced
-- por el motor de Postgres). Pero fase E requiere pre-condiciones (auditoría
-- exhaustiva de escritores ocultos) que aún no están listas.
--
-- Mientras tanto, fase D va a migrar los 2 writers principales (verify/route.js
-- y queries.ts) para que llamen a transition_question_state(). Si esos writers
-- dejan de tocar is_active manualmente y solo cambian lifecycle_state, los
-- 89 readers (que filtran por is_active) seguirían viendo el estado obsoleto.
--
-- Solución intermedia: trigger sync. Cuando lifecycle_state cambia, is_active
-- se actualiza automáticamente. Esto nos da la invariante de fase E desde ya.
-- Cuando llegue fase E, este trigger se borra y is_active se vuelve GENERATED
-- (resultado equivalente, enforced por motor en vez de trigger).
--
-- IMPORTANTE: este trigger NO impide actualizar is_active directamente. Los
-- writers legacy que sigan tocando is_active = true/false directamente seguirán
-- funcionando hasta fase E. Es deliberado: facilita la migración gradual.
--
-- IDEMPOTENCIA: OR REPLACE / DROP IF EXISTS.
--
-- REVERSIÓN
-- ============================================================================
--   DROP TRIGGER IF EXISTS tg_questions_lifecycle_sync_active ON public.questions;
--   DROP FUNCTION IF EXISTS public.sync_is_active_from_lifecycle() CASCADE;

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.sync_is_active_from_lifecycle() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_should_be_active boolean;
BEGIN
  v_should_be_active := NEW.lifecycle_state IN ('approved', 'tech_approved');

  -- Solo update si difiere (evita escrituras y triggers en cascada innecesarios)
  IF NEW.is_active IS DISTINCT FROM v_should_be_active THEN
    NEW.is_active := v_should_be_active;
    -- Limpiar deactivation_reason cuando se reactiva (semántica legacy)
    IF v_should_be_active AND NEW.deactivation_reason IS NOT NULL THEN
      NEW.deactivation_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_is_active_from_lifecycle IS
  'Trigger BEFORE UPDATE OF lifecycle_state: sincroniza is_active desde lifecycle_state. '
  'Cierra la ventana de desync entre fase B y fase E del roadmap lifecycle. '
  'Se borrará en fase E cuando is_active pase a GENERATED column.';

-- BEFORE UPDATE (no AFTER) para que NEW.is_active se setee antes de escribir.
-- Esto evita un segundo UPDATE en cascada.
DROP TRIGGER IF EXISTS tg_questions_lifecycle_sync_active ON public.questions;

CREATE TRIGGER tg_questions_lifecycle_sync_active
BEFORE UPDATE OF lifecycle_state ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.sync_is_active_from_lifecycle();

-- También para INSERTs: si se inserta con lifecycle_state explícito distinto
-- al default 'draft', is_active debe quedar coherente desde el primer momento.
DROP TRIGGER IF EXISTS tg_questions_lifecycle_sync_active_insert ON public.questions;

CREATE TRIGGER tg_questions_lifecycle_sync_active_insert
BEFORE INSERT ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.sync_is_active_from_lifecycle();

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- 1) Triggers creados:
--    SELECT tgname FROM pg_trigger WHERE tgrelid='public.questions'::regclass
--    AND tgname LIKE '%sync_active%';
--    Esperado: 2 triggers (BEFORE UPDATE + BEFORE INSERT)
--
-- 2) Smoke test sync update:
--    BEGIN;
--    -- Pregunta approved + is_active=true
--    SELECT public.transition_question_state(
--      (SELECT id FROM questions WHERE lifecycle_state='approved' LIMIT 1),
--      'approved', 'needs_review', 'admin_marked_problem');
--    -- Verificar que is_active pasó a false automáticamente
--    SELECT lifecycle_state, is_active FROM questions WHERE id = (SELECT id FROM questions WHERE lifecycle_state='needs_review' AND is_active=false LIMIT 1);
--    -- Esperado: lifecycle_state='needs_review', is_active=false
--    ROLLBACK;
--
-- 3) Smoke test sync insert con lifecycle_state explícito:
--    BEGIN;
--    INSERT INTO questions (id, question_text, option_a, option_b, option_c, correct_option, explanation, primary_article_id, lifecycle_state)
--    VALUES (gen_random_uuid(), 'TEST', 'a','b','c',0,'e', (SELECT id FROM articles LIMIT 1), 'approved')
--    RETURNING id, is_active, lifecycle_state;
--    -- Esperado: is_active=true (porque lifecycle_state=approved está en visible)
--    ROLLBACK;
--
-- 4) Smoke test default: insert sin lifecycle_state → 'draft' → is_active=false
--    BEGIN;
--    INSERT INTO questions (id, question_text, option_a, option_b, option_c, correct_option, explanation, primary_article_id)
--    VALUES (gen_random_uuid(), 'TEST', 'a','b','c',0,'e', (SELECT id FROM articles LIMIT 1))
--    RETURNING id, is_active, lifecycle_state;
--    -- Esperado: is_active=false (porque lifecycle_state default='draft' → not visible)
--    ROLLBACK;
