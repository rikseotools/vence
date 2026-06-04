-- Gate: una pregunta VISIBLE (approved/tech_approved) no puede tener una opción
-- con CADENA VACÍA ('') — eso es una pregunta malformada que el fetcher
-- (`[a,b,c,d,e].filter(v !== '')`) sirve con menos opciones de las debidas.
--
-- Origen: 04/06/2026. La pregunta a6bb4c5f (art.13 Ley 39/2015, scrapeada tag CyL)
-- tenía option_d='' → renderizaba 3 opciones; se le sirvió a Nila vía una ley
-- estatal compartida. El check `empty_options` de /admin/calidad ya la DETECTABA
-- (count=1), pero Calidad solo detecta, no impide servir. Este constraint es el
-- ENFORCEMENT que faltaba, en el único chokepoint físico (la tabla).
--
-- CLAVE — distingue malformada de 3-opción legítima:
--   - option_x = ''   (cadena vacía)  → TRUE  → bloquea   (malformada)
--   - option_x = null (no existe 4ª)  → NULL  → pasa      (3-opción legítima:
--                                                          policía PN, etc.)
--   - option_x con texto             → FALSE → pasa      (normal)
-- Por la lógica trivaluada de SQL, un CHECK solo falla cuando evalúa a FALSE;
-- NULL pasa. Así NO marca como infractoras las preguntas de policía (option_d=null).
--
-- NOT VALID: no escanea las filas existentes (evita lock largo en una tabla
-- grande). Se enforcea en cada INSERT/UPDATE a partir de ya. Verificado 04/06:
-- 0 preguntas visibles infringen (a6bb4c5f retirada a needs_human), así que
-- un futuro VALIDATE CONSTRAINT pasaría limpio.

-- Idempotente (ya aplicado a prod a mano el 04/06; este DROP evita error si se re-corre).
ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_visible_no_empty_option;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_visible_no_empty_option
  CHECK (
    lifecycle_state NOT IN ('approved', 'tech_approved')
    OR NOT (
      option_a = '' OR option_b = '' OR option_c = '' OR option_d = '' OR option_e = ''
    )
  ) NOT VALID;

COMMENT ON CONSTRAINT questions_visible_no_empty_option ON public.questions IS
  'Una pregunta visible no puede tener una opción = cadena vacía (malformada → render con menos opciones). option_x=null (3-opción legítima, p.ej. policía) sí se permite. Añadido 04/06/2026 tras el caso a6bb4c5f (Nila).';
