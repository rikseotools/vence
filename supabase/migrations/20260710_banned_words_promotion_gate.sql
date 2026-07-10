-- Incidente 10/07/2026: 1.901 preguntas (804 VISIBLES) filtraban el nombre de plataformas
-- competidoras (Aulaplus, OpositaTest) en `explanation`, importadas de bancos externos con
-- notas editoriales ("modificada por Aulaplus...") que llegaron a producción.
--
-- Prevención POR CONSTRUCCIÓN: el único camino legítimo a un estado visible es
-- transition_question_state(). Añadimos un GATE ANTI-COMPETIDOR que rechaza cualquier
-- promoción a 'approved'/'tech_approved' si el texto (enunciado, opciones o explicación)
-- menciona un competidor. Aplica INCLUSO a reason_codes admin_% (una mención a competidor
-- nunca debe ser visible, la ponga quien la ponga).
--
-- La regex vive en una única función IMMUTABLE reutilizable (guard + canary + panel calidad).

BEGIN;

-- 1) Detector único de menciones a competidor (fuente de verdad de la lista).
CREATE OR REPLACE FUNCTION public.contains_banned_competitor(p_text text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT COALESCE(p_text, '') ~* '(oposita\s*[-_./@*]?\s*test|opositest|oposistatest|tutestdigital|tu\s*test\s*digital|tutest\s*online|aula\s*[-_./@*]?\s*plus|aulaplus)';
$$;

COMMENT ON FUNCTION public.contains_banned_competitor(text) IS
  'TRUE si el texto menciona una plataforma competidora (opositatest/tutestdigital/aulaplus y variantes). Fuente única de la lista negra; usada por el gate de transition_question_state y por el canario de calidad.';

-- 2) Re-crear transition_question_state con el GATE ANTI-COMPETIDOR añadido tras el gate de IA.
CREATE OR REPLACE FUNCTION public.transition_question_state(p_question_id uuid, p_expected_state text, p_new_state text, p_reason_code text, p_changed_by uuid DEFAULT NULL::uuid, p_ai_verification_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_current text;
BEGIN
  IF p_new_state IS NULL OR p_new_state NOT IN ('draft','needs_review','needs_human','quarantine','approved','tech_approved','retired_duplicate','retired_irreparable') THEN
    RAISE EXCEPTION 'Invalid p_new_state: %', COALESCE(p_new_state, 'NULL');
  END IF;
  IF p_reason_code IS NULL OR length(trim(p_reason_code)) = 0 THEN
    RAISE EXCEPTION 'p_reason_code is required';
  END IF;
  PERFORM set_config('app.lifecycle_via_function', 'true', true);
  SELECT lifecycle_state INTO v_current FROM public.questions WHERE id = p_question_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Question % not found', p_question_id; END IF;
  IF v_current IS DISTINCT FROM p_expected_state THEN
    RAISE EXCEPTION 'State mismatch on question %: expected %, got %', p_question_id, p_expected_state, COALESCE(v_current, 'NULL');
  END IF;
  IF v_current = p_new_state THEN RAISE EXCEPTION 'Same-state transition rejected: % -> %', v_current, p_new_state; END IF;
  IF v_current IN ('retired_duplicate','retired_irreparable') THEN RAISE EXCEPTION 'Cannot transition from terminal state %', v_current; END IF;
  IF v_current IS NOT NULL THEN
    IF NOT (
      (v_current = 'draft'         AND p_new_state IN ('needs_review','needs_human','approved','tech_approved','quarantine','retired_duplicate','retired_irreparable'))
      OR (v_current = 'needs_review' AND p_new_state IN ('approved','tech_approved','needs_human','retired_duplicate','retired_irreparable'))
      OR (v_current = 'needs_human'  AND p_new_state IN ('approved','tech_approved','needs_review','retired_duplicate','retired_irreparable'))
      OR (v_current = 'quarantine'   AND p_new_state IN ('draft','retired_irreparable'))
      OR (v_current = 'approved'     AND p_new_state IN ('needs_review','needs_human','draft','retired_duplicate','retired_irreparable'))
      OR (v_current = 'tech_approved' AND p_new_state IN ('needs_review','needs_human','draft','retired_duplicate','retired_irreparable'))
    ) THEN RAISE EXCEPTION 'Illegal transition: % -> %', v_current, p_new_state; END IF;
  END IF;
  -- GATE DE CONTENIDO (palanca 1, incidente 02/06/2026 q 83daa594 false-perfect):
  -- promociones automaticas a estado visible exigen verificacion completa; admin_% puede forzar.
  IF p_new_state IN ('approved','tech_approved') AND p_reason_code NOT LIKE 'admin_%' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ai_verification_results av
      WHERE av.question_id = p_question_id
        AND av.answer_ok IS TRUE
        AND av.explanation_ok IS TRUE
        AND av.article_ok IS DISTINCT FROM FALSE
        AND av.options_ok IS DISTINCT FROM FALSE
        AND COALESCE(av.discarded, false) = false
    ) THEN
      RAISE EXCEPTION 'AI promotion blocked: question % lacks a passing verification (needs answer_ok+explanation_ok TRUE and article_ok/options_ok not FALSE)', p_question_id;
    END IF;
  END IF;
  -- GATE ANTI-COMPETIDOR (incidente 10/07/2026): ninguna pregunta con mencion a plataforma
  -- competidora puede hacerse visible, ni por admin. Sin excepcion de reason_code.
  IF p_new_state IN ('approved','tech_approved') THEN
    IF EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = p_question_id
        AND public.contains_banned_competitor(
              concat_ws(' ', q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.explanation))
    ) THEN
      RAISE EXCEPTION 'Promotion blocked: question % contains a competitor mention (banned words) — clean the text before making it visible', p_question_id;
    END IF;
  END IF;
  UPDATE public.questions SET lifecycle_state = p_new_state WHERE id = p_question_id;
  INSERT INTO public.question_lifecycle_history (question_id, from_state, to_state, reason_code, changed_by, ai_verification_id, notes)
  VALUES (p_question_id, v_current, p_new_state, p_reason_code, p_changed_by, p_ai_verification_id, p_notes);
END;
$function$;

COMMIT;
