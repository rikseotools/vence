-- 20260725_provenance_doc_hub.sql
--
-- HUB de provenance de documentos oficiales. `convocatoria_documentos` pasa a ser el
-- único almacén: todo lo que referencia un documento oficial (seguimiento OEP, hitos,
-- verificación de epígrafe, scope) PRODUCE vía la función `ensure_convocatoria_documento`
-- y CONSUME por FK. Cierra el falso verde de provenance (T-107): antes la verificación de
-- epígrafe guardaba una URL de texto libre (txt.php ≠ /pdfs → no casaba con la fila clonada).
--
-- Todo ADITIVO e idempotente (columnas nullable, índice parcial, función CREATE OR REPLACE).
-- La identidad canónica `doc_key` la calcula el ÚNICO canonicalizador JS
-- (lib/convocatoria/canonicalizeBoletinUrl.cjs) y se pasa a la función; el motor solo dedup+inserta.

-- 1) Identidad canónica del documento (BOE-A-2025-26262, BOCM-20260218-2, o URL normalizada)
ALTER TABLE convocatoria_documentos ADD COLUMN IF NOT EXISTS doc_key text;

COMMENT ON COLUMN convocatoria_documentos.doc_key IS
  'Identidad canónica del documento (id de boletín o URL normalizada). La calcula lib/convocatoria/canonicalizeBoletinUrl.cjs. Dedup por (convocatoria_id, doc_key).';

-- 1.bis) La verificación de epígrafe es un nuevo PRODUCTOR del hub → ampliar orígenes permitidos.
ALTER TABLE convocatoria_documentos DROP CONSTRAINT IF EXISTS convocatoria_documentos_fuente_check;
ALTER TABLE convocatoria_documentos ADD CONSTRAINT convocatoria_documentos_fuente_check
  CHECK (fuente = ANY (ARRAY['detect-notas','radar','seguimiento','manual','backfill-titulo','epigrafe-verify']));

-- 2) Dedup: un documento canónico por convocatoria. PARCIAL para no bloquear filas legacy
--    aún sin backfill (doc_key NULL). Las filas nuevas (vía ensure_…) siempre lo llevan.
CREATE UNIQUE INDEX IF NOT EXISTS ux_convocatoria_documentos_conv_dockey
  ON convocatoria_documentos (convocatoria_id, doc_key)
  WHERE doc_key IS NOT NULL;

-- 3) La verificación de epígrafe enlaza al documento clonado (mismo patrón que
--    convocatoria_hitos.source_documento_id). source_url queda como espejo denormalizado.
ALTER TABLE topic_epigrafe_verification
  ADD COLUMN IF NOT EXISTS source_documento_id uuid REFERENCES convocatoria_documentos(id);

COMMENT ON COLUMN topic_epigrafe_verification.source_documento_id IS
  'FK al documento oficial clonado (hub convocatoria_documentos) del que se clonó el epígrafe. Verdad de provenance; source_url es espejo. Invariante: verified_literal ⇒ NOT NULL (tras backfill).';

-- 4) ÚNICO camino de escritura del hub. Idempotente por (convocatoria_id, doc_key).
--    La llaman por igual el backend (Drizzle raw) y los scripts .cjs (pg) → dedup idéntico,
--    runtime-agnóstico. Mismo estilo que transition_question_state / record_epigrafe_verification.
CREATE OR REPLACE FUNCTION ensure_convocatoria_documento(
  p_convocatoria_id uuid,
  p_doc_key         text,
  p_canonical_url   text,
  p_content_hash    text DEFAULT NULL,
  p_tipo            text DEFAULT 'convocatoria',
  p_titulo          text DEFAULT NULL,
  p_extracted_text  text DEFAULT NULL,
  p_fuente          text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_convocatoria_id IS NULL THEN
    RAISE EXCEPTION 'ensure_convocatoria_documento: convocatoria_id requerido';
  END IF;
  IF p_doc_key IS NULL OR btrim(p_doc_key) = '' THEN
    RAISE EXCEPTION 'ensure_convocatoria_documento: doc_key requerido (canonicaliza la URL antes con canonicalizeBoletinUrl)';
  END IF;

  -- ¿ya existe el documento canónico para esta convocatoria?
  SELECT id INTO v_id FROM convocatoria_documentos
   WHERE convocatoria_id = p_convocatoria_id AND doc_key = p_doc_key
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    -- enriquecer sin pisar: rellena hash/texto solo si faltaban
    UPDATE convocatoria_documentos
       SET content_hash   = COALESCE(content_hash, p_content_hash),
           extracted_text = COALESCE(NULLIF(extracted_text, ''), p_extracted_text),
           updated_at     = now()
     WHERE id = v_id
       AND (content_hash IS NULL OR NULLIF(extracted_text, '') IS NULL);
    RETURN v_id;
  END IF;

  -- insertar; ante carrera, el índice único reconduce al SELECT
  BEGIN
    INSERT INTO convocatoria_documentos
      (convocatoria_id, doc_key, url, tipo, titulo, content_hash, extracted_text, fuente, fetched_at, created_at, updated_at)
    VALUES
      (p_convocatoria_id, p_doc_key, p_canonical_url, COALESCE(p_tipo, 'convocatoria'),
       p_titulo, p_content_hash, p_extracted_text, COALESCE(p_fuente, 'manual'), now(), now(), now())
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM convocatoria_documentos
     WHERE convocatoria_id = p_convocatoria_id AND doc_key = p_doc_key
     LIMIT 1;
  END;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION ensure_convocatoria_documento(uuid, text, text, text, text, text, text, text) IS
  'Único camino de escritura del hub de provenance. Idempotente por (convocatoria_id, doc_key). Devuelve el id del documento (existente o nuevo). Ver docs/maintenance/provenance-convocatorias.md.';
