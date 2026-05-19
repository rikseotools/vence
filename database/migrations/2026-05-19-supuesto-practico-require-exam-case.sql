-- Migration 2026-05-19: trigger que impide que preguntas marcadas como
-- "Supuesto práctico" en exam_source sean visibles sin exam_case_id vinculado.
--
-- Contexto: el 19/05/2026 detectamos 74 preguntas huérfanas (3 convocatorias
-- CARM 2020/2023/2024) con exam_source="...Supuesto práctico" y exam_case_id
-- NULL. Aparecían en tests aislados sin contexto narrativo, irresolubles para
-- el opositor. Detectado por dispute de usuaria — resuelto importando los 6
-- exam_cases y vinculando. Este trigger previene que vuelva a pasar por
-- construcción (defense in depth, complementa los tests de integración en
-- __tests__/integration/supuestoPracticoOrphans.test.ts).
--
-- Manual: docs/maintenance/impugnaciones-claude-code.md §7.4.ter
-- Memoria: project_carm_supuestos_pendientes.md

CREATE OR REPLACE FUNCTION public.tg_questions_require_exam_case_for_supuesto()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.exam_source IS NOT NULL
     AND NEW.exam_source ILIKE '%Supuesto práctico%'
     AND NEW.exam_case_id IS NULL
     AND NEW.lifecycle_state IN ('approved', 'tech_approved')
  THEN
    RAISE EXCEPTION
      'Question marked as "Supuesto práctico" in exam_source cannot be approved/tech_approved without exam_case_id. question_id=%, exam_source=%',
      NEW.id, NEW.exam_source
      USING ERRCODE = 'check_violation',
            HINT = 'Import the supuesto narrative into exam_cases first and set exam_case_id before approving.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_questions_require_exam_case_for_supuesto ON public.questions;

CREATE TRIGGER tg_questions_require_exam_case_for_supuesto
  BEFORE INSERT OR UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_questions_require_exam_case_for_supuesto();

COMMENT ON FUNCTION public.tg_questions_require_exam_case_for_supuesto() IS
  'Bloquea INSERT/UPDATE que dejaría una pregunta marcada como "Supuesto práctico" visible (lifecycle_state=approved/tech_approved) sin exam_case_id. Defense in depth contra el bug del 19/05/2026 (74 huérfanas CARM).';
