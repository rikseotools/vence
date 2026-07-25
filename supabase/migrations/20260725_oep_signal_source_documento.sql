-- 20260725_oep_signal_source_documento.sql
--
-- Señales OEP → hub: cuando una señal cita un DOCUMENTO oficial (source_url = BOE/BOCM), enlazarlo
-- al documento clonado. FK disperso por diseño: la mayoría de señales apuntan a páginas de
-- listado/procedimiento (no documentos) → quedan NULL, correcto. Los hashes de MONITOREO
-- (seguimiento_last_hash/programa_last_hash/seguimiento_checks.content_hash) NO se enlazan: son
-- cachés de detección-de-cambios de su propio pipeline (hashean página normalizada, no el texto
-- del documento; solo 2/11204 coinciden con el corpus), no provenance. Su OUTPUT (documentos
-- detectados) ya cae al hub como notas vía detect-notas.
ALTER TABLE oep_detection_signals
  ADD COLUMN IF NOT EXISTS source_documento_id uuid REFERENCES convocatoria_documentos(id);

COMMENT ON COLUMN oep_detection_signals.source_documento_id IS
  'FK al documento oficial clonado (hub) cuando la señal cita un documento (BOE/BOCM). Disperso: NULL para señales que apuntan a páginas de listado. Ver docs/runbooks/provenance-convocatorias.md.';
