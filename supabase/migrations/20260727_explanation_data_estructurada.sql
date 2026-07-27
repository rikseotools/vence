-- 20260727_explanation_data_estructurada.sql
-- Fase 2 de T-080: explicación ESTRUCTURADA por-opción, sin letras.
--
-- ## Por qué
--
-- El formato §8.1 clava la LETRA dentro del texto ("**Por qué B es correcta:**", bullets
-- "- **A)** …"). Con la letra dentro, barajar las opciones convierte la explicación en mentira, y
-- por eso esas preguntas quedan `shuffle_safety='unsafe'`. Medido el 27/07/2026 sobre activas:
-- **47.388 preguntas son unsafe SOLO por `explanation_refs_letters`** — el 34% del banco y el 72%
-- de todo lo que bloquea el barajado.
--
-- Y había una trampa peor: el manual v2.6 ya declara canónico el formato SIN letras, pero **no
-- había dónde guardarlo**, mientras el gate mecánico exige la cabecera con letra. O sea que toda
-- explicación reescrita nacía `unsafe`. De las 22.091 explicaciones cortas candidatas a mejora,
-- **17.491 son HOY safe**: añadirles la cabecera con letra las habría vuelto unsafe. Mejorar la
-- calidad estaba destruyendo barajabilidad.
--
-- `explanation_data` guarda las razones keadas al ÍNDICE ORIGINAL de cada opción (0=A..3=D); la
-- letra se asigna en el render por posición. Barajar mueve cada opción CON su razón → shuffle-safe
-- por construcción. Esquema, render y parser de migración: `lib/shuffle/structuredExplanation.ts`
-- (18 tests; invariante ida-vuelta verificada en 44.155 permutaciones reales, 0 fallos).
--
-- ## Seguridad
--
-- ADITIVA y reversible: `NULL` por defecto → el serve sigue leyendo `explanation` como hoy y no se
-- enciende ningún flag de barajado. Idempotente.
--
-- ⚠️ Koigrid: esta columna y sus datos deben viajar junto a las dos migraciones del 22/07
-- (`20260722_shuffle_options_fase1` y `20260722_shuffle_safety_verification`).

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS explanation_data jsonb;

COMMENT ON COLUMN public.questions.explanation_data IS
  'Explicación ESTRUCTURADA por-opción sin letras (Fase 2 de T-080). Esquema {v,intro?,cita?,options{"0".."4"},outro?,frame}: las razones se keaan al índice ORIGINAL de la opción y la letra se asigna al renderizar, así que barajar mueve cada opción con su razón. Si está presente, el serve renderiza desde aquí y la pregunta es shuffle-safe por construcción; si es NULL, se sirve `explanation` tal cual. Ver lib/shuffle/structuredExplanation.ts.';

-- ── El hash anti-drift ahora vigila también `explanation_data` ────────────────────────────────
--
-- ⚠️ COMPATIBILIDAD HACIA ATRÁS, y no es un detalle: el trigger compara el hash GUARDADO con el
-- recalculado y, si difieren, degrada la clasificación a `stale`. Si la fórmula cambiara para
-- todas las filas, **las 134.630 clasificaciones ya verificadas (68.832 safe + 65.798 unsafe) se
-- invalidarían en el siguiente UPDATE de cada fila** — se tiraría el trabajo de las dos capas de
-- clasificación (determinista + LLM ensemble). Por eso el campo nuevo solo entra en el hash
-- **cuando NO es NULL**: para toda fila sin explicación estructurada el hash es BIT A BIT el
-- mismo que antes de esta migración.
CREATE OR REPLACE FUNCTION public.compute_shuffle_safety_hash(
  p_explanation text,
  p_a text, p_b text, p_c text, p_d text, p_e text,
  p_mode text,
  p_explanation_data text DEFAULT NULL
) RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT md5(
    coalesce(p_explanation,'') || '␟' ||
    coalesce(p_a,'') || '␟' || coalesce(p_b,'') || '␟' || coalesce(p_c,'') || '␟' ||
    coalesce(p_d,'') || '␟' || coalesce(p_e,'') || '␟' || coalesce(p_mode,'') ||
    -- Solo suma al hash si hay estructura: sin esto, todas las filas existentes cambiarían de
    -- hash y el trigger las degradaría a 'stale'.
    CASE WHEN p_explanation_data IS NULL THEN '' ELSE '␟' || p_explanation_data END
  );
$function$;

-- El trigger pasa a alimentar el hash con la columna nueva.
CREATE OR REPLACE FUNCTION public.tg_questions_shuffle_safety_invalidate()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.shuffle_safety IN ('safe','unsafe')
     AND NEW.shuffle_safety_hash IS DISTINCT FROM public.compute_shuffle_safety_hash(
       NEW.explanation, NEW.option_a, NEW.option_b, NEW.option_c, NEW.option_d, NEW.option_e,
       NEW.shuffle_mode, NEW.explanation_data::text
     )
  THEN
    NEW.shuffle_safety := 'stale';
  END IF;
  RETURN NEW;
END$function$;

-- Y el registrador de veredictos, para que guarde el hash con la misma fórmula que el trigger
-- comprueba (si divergieran, cada UPDATE degradaría a `stale` lo que se acaba de verificar).
CREATE OR REPLACE FUNCTION public.record_shuffle_safety(
  p_question_id uuid, p_state text, p_reason text, p_verified_by text
) RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE v_hash text;
BEGIN
  IF p_state NOT IN ('unverified','safe','unsafe','stale') THEN
    RAISE EXCEPTION 'estado shuffle_safety inválido: %', p_state;
  END IF;
  SELECT public.compute_shuffle_safety_hash(
           q.explanation, q.option_a, q.option_b, q.option_c, q.option_d, q.option_e,
           q.shuffle_mode, q.explanation_data::text)
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
END$function$;
