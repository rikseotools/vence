-- Variante SISTEMA SELECTIVO (oposición / concurso-oposición / concurso) — capturarla
-- en toda la cadena. Antes: nadie la capturaba (ni señales, ni radar, ni competidores).
-- Es ortogonal al ACCESO (libre/PI/disc, ya capturado por el desglose de plazas).
-- Additivo, nullable (null = no consta / no capturado). Aplicado a prod 2026-07-08.
-- Cableado: extracción LLM (prompt+schema) → detected_sistema → apply promueve a
-- convocatorias.sistema_selectivo + oposiciones.sistema_selectivo (COALESCE).

ALTER TABLE oep_detection_signals ADD COLUMN IF NOT EXISTS detected_sistema text;

ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS sistema_selectivo text;
ALTER TABLE convocatorias ADD CONSTRAINT convocatorias_sistema_chk
  CHECK (sistema_selectivo IS NULL OR sistema_selectivo IN ('oposicion','concurso-oposicion','concurso'));

ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS sistema_selectivo text;
ALTER TABLE oposiciones ADD CONSTRAINT oposiciones_sistema_chk
  CHECK (sistema_selectivo IS NULL OR sistema_selectivo IN ('oposicion','concurso-oposicion','concurso'));
