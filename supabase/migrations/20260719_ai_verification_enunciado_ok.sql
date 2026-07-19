-- enunciado_ok: nueva dimensión de la matriz de verificación de preguntas.
--
-- Motivo (cubo 1, destapado por la impugnación de Sandra 16/07): la matriz
-- (article_ok, answer_ok, options_ok, explanation_ok) NO tiene ninguna dimensión
-- para el ENUNCIADO. Una pregunta puede inventarse un órgano que no existe
-- ("Agencia Estatal de Administración Digital" cuando el RD 203/2021 dice
-- "Secretaría General de Administración Digital"), citar la ley equivocada, o
-- filtrar la respuesta, y salir `perfect` igual porque ningún check mira el
-- enunciado. `enunciado_ok=false` marca justamente eso.
--
-- Aditiva y nullable: no rompe nada. Los readers que no la conozcan la ignoran.
ALTER TABLE public.ai_verification_results
  ADD COLUMN IF NOT EXISTS enunciado_ok boolean;

COMMENT ON COLUMN public.ai_verification_results.enunciado_ok IS
  'El enunciado cita la norma/órgano correctos (no se inventa un organismo ausente del artículo), corresponde al artículo vinculado y no filtra la respuesta. NULL = no evaluado. Dimensión añadida 19/07/2026 (cubo 1, caso Sandra).';
