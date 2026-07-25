-- Gate de re-análisis LLM de `detect-notas-convocatoria` (25/07/2026).
--
-- El sensor llamaba a Haiku una vez por oposición EN CADA PASE DIARIO (~1.300 llamadas,
-- ~19M tokens, ≈17 $/día) aunque los PDFs fueran idénticos a los de la víspera: el 24/07
-- hubo 1.117 llamadas y sólo 5 documentos nuevos en el corpus.
--
-- El hash del texto y la extracción YA se guardaban; lo que faltaba era saber CUÁNDO se
-- analizó, para poder reutilizar la extracción mientras nada cambie y forzar un refresco
-- periódico (TTL escalonado, ver backend/src/detect-notas-convocatoria/notas-cache.ts).
--
-- Additiva y reversible: NULL = "nunca medido" → el sensor re-analiza esa oposición una vez
-- y a partir de ahí sella la fecha.

ALTER TABLE public.convocatoria_notas
  ADD COLUMN IF NOT EXISTS llm_analyzed_at timestamptz;

COMMENT ON COLUMN public.convocatoria_notas.llm_analyzed_at IS
  'Cuándo se obtuvo `llm_extraction` con una llamada real al LLM. NULL = nunca. Lo usa el gate de re-análisis del sensor detect-notas-convocatoria para no repetir la extracción mientras el content_hash de las notas no cambie.';
