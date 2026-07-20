-- T-048 capa 3 — GATE que impide hacer visible una pregunta cuya CLAVE cae en un inciso que el
-- Tribunal Constitucional declaró nulo.
--
-- Incidente que lo motiva (19/07): una pregunta de Aux. CARM daba por buena la respuesta del
-- inciso del art. 126.2 LBRL que la STC 103/2013 tumbó. El artículo importado no traía nota de
-- vigencia (eso lo arregla la capa 1) y la clave apuntaba al texto muerto. Le respondimos MAL la
-- impugnación al usuario antes de que reabriera como bug.
--
-- Capas del arreglo: 1) capturar la vigencia al importar · 2) pintarla tachada · **3) este gate**.
-- Las dos primeras evitan que el redactor se equivoque; esta impide que el error llegue a producción
-- aunque se equivoque igual. Prevención POR CONSTRUCCIÓN, como el gate anti-competidor del 10/07:
-- el único camino legítimo a un estado visible es transition_question_state().
--
-- Alcance deliberadamente ESTRECHO (un gate que da falsos positivos se acaba desactivando):
--   · Solo mira la OPCIÓN CORRECTA, no el enunciado ni los distractores. Un distractor que cite
--     el inciso anulado es legítimo (y hasta pedagógico).
--   · Solo bloquea si el solape es SUSTANCIAL (≥60 caracteres de la opción aparecen literalmente
--     dentro del fragmento anulado). Una coincidencia de tres palabras no basta.
--   · Solo actúa si el artículo TIENE fragmentos anulados capturados. Con vigencia_notes NULL
--     (aún no capturado) no bloquea nada: no sabemos, y no se puede exigir lo que no se sabe.

BEGIN;

-- 1) Detector reutilizable (gate + canario + panel de calidad), como contains_banned_competitor.
CREATE OR REPLACE FUNCTION public.answer_falls_in_annulled_fragment(
  p_answer text,
  p_vigencia jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_frag text;
  v_ans  text;
  v_norm text;
BEGIN
  IF p_answer IS NULL OR p_vigencia IS NULL THEN RETURN false; END IF;
  IF jsonb_typeof(p_vigencia -> 'annulledFragments') <> 'array' THEN RETURN false; END IF;

  -- Normalización simétrica: minúsculas y espacios colapsados en AMBOS lados. Sin esto, el
  -- reflow del importador (saltos de línea a mitad de frase) daría falsos negativos.
  v_ans := lower(regexp_replace(trim(p_answer), '\s+', ' ', 'g'));
  IF length(v_ans) < 60 THEN RETURN false; END IF;  -- opciones cortas: demasiado ruido

  FOR v_frag IN SELECT jsonb_array_elements_text(p_vigencia -> 'annulledFragments') LOOP
    v_norm := lower(regexp_replace(trim(v_frag), '\s+', ' ', 'g'));
    IF v_norm <> '' AND position(left(v_ans, 60) in v_norm) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.answer_falls_in_annulled_fragment(text, jsonb) IS
  'TRUE si la opción correcta reproduce (>=60 chars) un inciso que el TC declaró nulo, según '
  'articles.vigencia_notes. Solo mira la clave, no los distractores. Usada por el gate de '
  'transition_question_state. Ver T-048 y el incidente art. 126.2 LBRL / STC 103/2013.';

-- 2) Re-crear transition_question_state añadiendo el gate DESPUÉS del anti-competidor.
--    Se reproduce la función entera porque CREATE OR REPLACE no permite parchear un trozo.
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
  IF NOT (
      (v_current = 'draft'         AND p_new_state IN ('needs_review','needs_human','approved','tech_approved','quarantine','retired_duplicate','retired_irreparable'))
      OR (v_current = 'needs_review' AND p_new_state IN ('approved','tech_approved','needs_human','retired_duplicate','retired_irreparable'))
      OR (v_current = 'needs_human'  AND p_new_state IN ('approved','tech_approved','needs_review','retired_duplicate','retired_irreparable'))
      OR (v_current = 'quarantine'   AND p_new_state IN ('needs_review','needs_human','draft','retired_duplicate','retired_irreparable'))
      OR (v_current = 'approved'     AND p_new_state IN ('needs_review','needs_human','draft','retired_duplicate','retired_irreparable'))
      OR (v_current = 'tech_approved' AND p_new_state IN ('needs_review','needs_human','draft','retired_duplicate','retired_irreparable'))
  ) THEN
    RAISE EXCEPTION 'Illegal transition % -> %', v_current, p_new_state;
  END IF;

  -- GATE ANTI-COMPETIDOR (10/07)
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

  -- GATE DE INCISO ANULADO POR EL TC (20/07, T-048 capa 3)
  IF p_new_state IN ('approved','tech_approved') THEN
    IF EXISTS (
      SELECT 1
      FROM public.questions q
      JOIN public.articles a ON a.id = q.primary_article_id
      WHERE q.id = p_question_id
        AND a.vigencia_notes IS NOT NULL
        AND public.answer_falls_in_annulled_fragment(
              (ARRAY[q.option_a, q.option_b, q.option_c, q.option_d])[q.correct_option + 1],
              a.vigencia_notes)
    ) THEN
      RAISE EXCEPTION 'Promotion blocked: the correct answer of question % reproduces a fragment annulled by the Constitutional Court (see articles.vigencia_notes) — the answer is no longer valid law', p_question_id;
    END IF;
  END IF;

  UPDATE public.questions SET lifecycle_state = p_new_state WHERE id = p_question_id;
  INSERT INTO public.question_lifecycle_history (question_id, from_state, to_state, reason_code, changed_by, ai_verification_id, notes)
  VALUES (p_question_id, v_current, p_new_state, p_reason_code, p_changed_by, p_ai_verification_id, p_notes);
END;
$function$;

COMMIT;
