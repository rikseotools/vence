-- Barajar opciones — verificación robusta (Paso 1): la seguridad de barajar como
-- DATO verificado, persistido y AUTO-INVALIDABLE, no un regex en cada request.
-- Diseño: docs/roadmap/barajar-opciones-verificacion-robusta.md. Tarea T-080.
--
-- Calcado a topic_scope_verification (20260710): estado + hash de contenido + trigger
-- que marca 'stale' cuando el contenido cambia. Additivo e INERTE: hasta backfill todo
-- es 'unverified' → el serve no baraja nada (más inerte todavía).

-- 1) Columnas de verificación en questions.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS shuffle_safety text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS shuffle_safety_reason text,
  ADD COLUMN IF NOT EXISTS shuffle_safety_hash text,
  ADD COLUMN IF NOT EXISTS shuffle_safety_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS shuffle_safety_verified_by text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_shuffle_safety_check') THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_shuffle_safety_check
      CHECK (shuffle_safety IN ('unverified','safe','unsafe','stale'));
  END IF;
END$$;

COMMENT ON COLUMN public.questions.shuffle_safety IS
  'Seguridad de barajar opciones (barajar-opciones verificación robusta). unverified(default)/safe/unsafe/stale. El serve solo baraja las safe. Auto-invalidada a stale por trigger al cambiar el contenido. Ver docs/roadmap/barajar-opciones-verificacion-robusta.md.';

-- 2) Hash determinista del contenido relevante (explicación + opciones + shuffle_mode).
--    Sobre este hash se emite el veredicto; si cambia, el trigger invalida a 'stale'.
CREATE OR REPLACE FUNCTION public.compute_shuffle_safety_hash(
  p_explanation text, p_a text, p_b text, p_c text, p_d text, p_e text, p_mode text
) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT md5(
    coalesce(p_explanation,'') || '␟' ||
    coalesce(p_a,'') || '␟' || coalesce(p_b,'') || '␟' || coalesce(p_c,'') || '␟' ||
    coalesce(p_d,'') || '␟' || coalesce(p_e,'') || '␟' || coalesce(p_mode,'')
  );
$$;

-- 3) Invalidación automática (anti-drift). BEFORE UPDATE puro (solo muta NEW → no puede
--    romper el UPDATE). Si el contenido NUEVO ya no casa con el hash sobre el que se
--    verificó y el estado era safe/unsafe → 'stale'. Cuando el verificador escribe
--    (state + hash actual) en el mismo UPDATE, casan → NO se marca stale.
CREATE OR REPLACE FUNCTION public.tg_questions_shuffle_safety_invalidate()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.shuffle_safety IN ('safe','unsafe')
     AND NEW.shuffle_safety_hash IS DISTINCT FROM public.compute_shuffle_safety_hash(
       NEW.explanation, NEW.option_a, NEW.option_b, NEW.option_c, NEW.option_d, NEW.option_e, NEW.shuffle_mode
     )
  THEN
    NEW.shuffle_safety := 'stale';
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS tg_questions_shuffle_safety_invalidate ON public.questions;
CREATE TRIGGER tg_questions_shuffle_safety_invalidate
  BEFORE UPDATE ON public.questions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_questions_shuffle_safety_invalidate();

-- 4) Audit append-only (provenance de cada veredicto). Fuente de verdad histórica.
CREATE TABLE IF NOT EXISTS public.question_shuffle_safety_history (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  question_id uuid NOT NULL,
  state       text NOT NULL,
  reason      text,
  content_hash text,
  verified_by text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_qss_hist_question ON public.question_shuffle_safety_history(question_id, created_at DESC);

-- 5) Única vía legítima de fijar el veredicto: captura el hash ACTUAL (así el trigger no
--    lo marca stale acto seguido) + registra en el audit. Usada por backfill y auditoría LLM.
CREATE OR REPLACE FUNCTION public.record_shuffle_safety(
  p_question_id uuid, p_state text, p_reason text, p_verified_by text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE v_hash text;
BEGIN
  IF p_state NOT IN ('unverified','safe','unsafe','stale') THEN
    RAISE EXCEPTION 'estado shuffle_safety inválido: %', p_state;
  END IF;
  SELECT public.compute_shuffle_safety_hash(q.explanation, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e, q.shuffle_mode)
    INTO v_hash FROM public.questions q WHERE q.id = p_question_id;

  UPDATE public.questions
     SET shuffle_safety = p_state,
         shuffle_safety_reason = p_reason,
         shuffle_safety_hash = v_hash,
         shuffle_safety_verified_at = now(),
         shuffle_safety_verified_by = p_verified_by
   WHERE id = p_question_id;

  INSERT INTO public.question_shuffle_safety_history (question_id, state, reason, content_hash, verified_by)
  VALUES (p_question_id, p_state, p_reason, v_hash, p_verified_by);
END$$;
