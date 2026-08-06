-- T-208 — corrige la DIRECCIÓN de comparación de `answer_falls_in_annulled_fragment` (T-048),
-- que da un falso positivo PERMANENTE desde el 21/07 (pregunta df73ec53, LO 4/2000 art. 58).
--
-- REPRODUCIDO contra datos reales (VENCE_LECTOR_URL), no supuesto:
--   · Clave correcta (option_a):
--       "Llevará consigo la prohibición de entrada en territorio español hasta cinco años
--        o hasta diez en circunstancias excepcionales." (expulsión, art. 58.1-2, VIGENTE)
--   · Fragmento anulado por la STC 17/2013 (art. 58.6, devolución):
--       "Asimismo, toda devolución acordada en aplicación del párrafo b) del mismo apartado
--        de este artículo llevará consigo la prohibición de entrada en territorio español
--        por un plazo máximo de tres años."
--   · La versión VIEJA comparaba `left(answer, 60) IN fragment` — los primeros 60 caracteres
--     de la clave («llevará consigo la prohibición de entrada en territorio espa») SON un
--     substring literal del fragmento, porque ambos incisos comparten la misma fórmula legal
--     de apertura y solo difieren en la cifra final (3 años vs 5-10 años). Es decir: el gate
--     dispara con BOILERPLATE compartido entre dos incisos DISTINTOS del mismo artículo, sin
--     que la parte que de verdad importa (la cifra) tenga que coincidir en ningún momento.
--   · Simulado en JS con el algoritmo de abajo sobre ese mismo par: da `false`. Con el
--     algoritmo VIEJO (`position(left(answer,60) in fragment)`) da `true` — confirma que
--     reproduce el bug exacto reportado, y que el nuevo lo cierra.
--
-- LA DIRECCIÓN CORRECTA es la que ya usa el núcleo puro `lib/laws/claveConIncisoAnulado.js`
-- (`analizarClave`, banda 'alta'): el FRAGMENTO anulado —no un trozo arbitrario de la
-- respuesta— tiene que aparecer LITERAL dentro de la respuesta. Es una comparación más
-- exigente (la respuesta tiene que reproducir el inciso completo, no solo compartir su
-- apertura) y es la que ese núcleo ya calibró en 0 falsos positivos sobre 203 preguntas.
--
-- Se añaden también los dos filtros que `claveConIncisoAnulado.js` ya aplica y el SQL no
-- tenía: descartar MARCADORES del BOE «(Anulado)»/«(Anulada).» (no son incisos comparables)
-- y RÚBRICAS de artículo capturadas por error como fragmento («Artículo N…»).
--
-- Alcance: SOLO esta función. `transition_question_state` la llama por nombre y no cambia —
-- no hace falta reproducirla entera (a diferencia de la migración que introdujo el gate).

BEGIN;

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

  -- Normalización simétrica: minúsculas y espacios colapsados en AMBOS lados (igual que la
  -- versión anterior — el reflow del importador mete saltos de línea a mitad de frase).
  v_ans := lower(regexp_replace(trim(p_answer), '\s+', ' ', 'g'));
  IF length(v_ans) = 0 THEN RETURN false; END IF;

  FOR v_frag IN SELECT jsonb_array_elements_text(p_vigencia -> 'annulledFragments') LOOP
    -- Marcador del BOE, no un inciso comparable: «(Anulado)», «(Anulada).», «(Derogado)».
    IF v_frag ~* '^\s*\(\s*(?:anulad|derogad)[oa]s?\s*\)\.?\s*$' THEN CONTINUE; END IF;
    -- Rúbrica del artículo capturada por error como fragmento: «Artículo 4. Funciones…».
    IF v_frag ~* '^\s*art(?:í|i)culo?\.?\s+\d' THEN CONTINUE; END IF;

    v_norm := lower(regexp_replace(trim(v_frag), '\s+', ' ', 'g'));

    -- DIRECCIÓN CORREGIDA (T-208): el FRAGMENTO anulado tiene que aparecer DENTRO de la
    -- respuesta — no un prefijo cualquiera de la respuesta dentro del fragmento. Umbral de
    -- 30 caracteres = MIN_DISTINTIVO en lib/laws/claveConIncisoAnulado.js: un fragmento más
    -- corto puede ser coincidencia léxica («favorable», «legalmente») y ese caso queda para
    -- revisión humana (auditor), no para bloquear automáticamente la promoción.
    IF length(v_norm) >= 30 AND position(v_norm in v_ans) > 0 THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.answer_falls_in_annulled_fragment(text, jsonb) IS
  'TRUE si la opción correcta reproduce LITERALMENTE (>=30 chars, tras filtrar marcadores y '
  'rúbricas) un inciso que el TC declaró nulo, según articles.vigencia_notes. Dirección '
  'corregida en T-208 (antes comparaba el prefijo de la respuesta contra el fragmento, al '
  'revés, y daba falsos positivos con boilerplate compartido entre incisos distintos del '
  'mismo artículo — caso df73ec53, LO 4/2000 art. 58). Mismo criterio que la banda "alta" '
  'de lib/laws/claveConIncisoAnulado.js#analizarClave. Solo mira la clave, no los '
  'distractores. Usada por el gate de transition_question_state. Ver T-048 y T-208.';

COMMIT;
