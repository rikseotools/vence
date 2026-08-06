-- Embudo determinista para detect-oep-llm (T-166).
--
-- POR QUÉ (06/08/2026). `detect-oep-llm` quedó PAUSADO en producción el 27/07
-- (`DETECT_OEP_LLM_ENABLED=false`) por coste: mandaba a Haiku el HTML de ~1.700
-- páginas/día laborable (~8 USD/día, ~170 USD/mes) para re-extraer páginas que en
-- su mayoría NO habían cambiado. Medido sobre 463 oposiciones con histórico
-- 8-21/07: el 52,3% no cambia NUNCA.
--
-- El embudo se salta la llamada al LLM cuando el texto que le llegaría al modelo
-- (los 20.000 caracteres que ve `extractOepFromHtml`, NO los 100.000 que hashea
-- `computeContentHash`) es BYTE A BYTE el mismo que la última vez. Necesita
-- persistir ese hash por oposición para poder comparar en la siguiente pasada.
--
-- ⚠️ NO se reutiliza `oposiciones.seguimiento_last_hash`: esa columna la escribe
-- el cron `check-seguimiento` con OTRO algoritmo (`extractRelevantText(html).slice(0,
-- 2000)`, ver `backend/src/check-seguimiento/seguimiento-fetch.ts`) para OTRO
-- propósito (el badge de `/admin/seguimiento-convocatorias`). Dos escritores con
-- distinto criterio sobre la MISMA columna no protegen nada — es exactamente el
-- antipatrón que este proyecto ya ha pagado antes (T-130: cinco escritores del
-- mismo campo sin verse entre sí). Columna NUEVA y propia de este sensor.

ALTER TABLE oposiciones
  ADD COLUMN IF NOT EXISTS oep_llm_input_hash text,
  ADD COLUMN IF NOT EXISTS oep_llm_input_hash_checked_at timestamptz;

COMMENT ON COLUMN oposiciones.oep_llm_input_hash IS
  'SHA-256 de EXACTAMENTE el texto (20.000 chars, limpio de HTML) que se le mandó al LLM en la última pasada de detect-oep-llm. Si en la siguiente pasada el hash no cambia, la llamada al LLM se salta (T-166). Escritor único: DetectOepLlmService.run(). NO confundir con seguimiento_last_hash (otro cron, otro algoritmo, otro propósito).';

COMMENT ON COLUMN oposiciones.oep_llm_input_hash_checked_at IS
  'Última vez que detect-oep-llm calculó el hash de arriba (llamara o no al LLM). Observabilidad: si esta fecha se queda vieja, el sensor no está corriendo sobre esa oposición.';
