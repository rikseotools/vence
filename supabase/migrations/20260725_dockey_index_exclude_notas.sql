-- 20260725_dockey_index_exclude_notas.sql
--
-- Separar los dos usos de convocatoria_documentos (decisión 25/07): documentos CANÓNICOS
-- (uno por documento → dedup por doc_key) vs NOTAS de monitoreo (tipo='nota', se APILAN por
-- cada cambio de la página de seguimiento = historial). El índice único (conv, doc_key) solo
-- debe gobernar los canónicos; si incluyera notas, dos snapshots de la misma página (mismo
-- doc_key, distinto content_hash) chocarían y se perdería el historial. Por eso lo excluye.
DROP INDEX IF EXISTS ux_convocatoria_documentos_conv_dockey;
CREATE UNIQUE INDEX IF NOT EXISTS ux_convocatoria_documentos_conv_dockey
  ON convocatoria_documentos (convocatoria_id, doc_key)
  WHERE doc_key IS NOT NULL AND tipo <> 'nota';
