-- 20260726_boletin_doc_key_boja.sql
--
-- Añade el BOJA (Boletín Oficial de la Junta de Andalucía) a boletin_doc_key(), espejando el
-- patrón nuevo de lib/convocatoria/canonicalizeBoletinUrl.cjs.
-- juntadeandalucia.es/boja/AAAA/NNN/NN → BOJA-AAAA-NNN-NN (año/nº boletín/nº disposición).
-- Motivado por la campaña T-107: varias oposiciones andaluzas en la cola con el programa en el BOJA.

CREATE OR REPLACE FUNCTION boletin_doc_key(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN RETURN NULL; END IF;
  DECLARE mm text[];
  BEGIN
    -- BOE-A/B/S-AAAA-N (disposiciones/anuncios/sumarios)
    k := (regexp_match(p_url, 'BOE-[ABS]-[0-9]{4}-[0-9]+', 'i'))[1];
    IF k IS NOT NULL THEN RETURN upper(k); END IF;
    -- BOCM-AAAAMMDD-N
    k := (regexp_match(p_url, 'BOCM-[0-9]{8}-[0-9]+', 'i'))[1];
    IF k IS NOT NULL THEN RETURN upper(k); END IF;
    -- DOGV (Valencia): dogv.gva.es/datos/AAAA/MM/DD/pdf/AAAA_NNNN → DOGV-AAAA-NNNN (variantes _es/_va convergen)
    mm := regexp_match(p_url, 'dogv\.gva\.es/datos/[0-9]{4}/[0-9]{2}/[0-9]{2}/pdf/([0-9]{4})_([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'DOGV-' || mm[1] || '-' || mm[2]; END IF;
    -- BOCYL (Castilla y León): código propio BOCYL-D-DDMMAAAA-NNN-NN
    k := (regexp_match(p_url, 'BOCYL-[A-Z]-[0-9]{8}-[0-9]+-[0-9]+', 'i'))[1];
    IF k IS NOT NULL THEN RETURN upper(k); END IF;
    -- DOGC (Cataluña): portaldogc.gencat.cat ... documentId=N
    k := (regexp_match(p_url, 'portaldogc\.gencat\.cat.*documentId=([0-9]+)', 'i'))[1];
    IF k IS NOT NULL THEN RETURN 'DOGC-' || k; END IF;
    -- BOC (Canarias): gobiernodecanarias.org/boc/AAAA/NNN/NNNN → BOC-AAAA-NNN-NNNN (.html/.pdf convergen)
    mm := regexp_match(p_url, 'gobiernodecanarias\.org/boc/([0-9]{4})/([0-9]+)/([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'BOC-' || mm[1] || '-' || mm[2] || '-' || mm[3]; END IF;
    -- BOJA (Andalucía): juntadeandalucia.es/boja/AAAA/NNN/NN → BOJA-AAAA-NNN-NN
    mm := regexp_match(p_url, 'juntadeandalucia\.es/boja/([0-9]{4})/([0-9]+)/([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'BOJA-' || mm[1] || '-' || mm[2] || '-' || mm[3]; END IF;
  END;
  -- reserva: url sin fragmento ni barra final
  RETURN regexp_replace(regexp_replace(btrim(p_url), '#.*$', ''), '/+$', '');
END;
$$;

COMMENT ON FUNCTION boletin_doc_key(text) IS
  'Espejo SQL de lib/convocatoria/canonicalizeBoletinUrl.cjs para el backend. doc_key canónico (BOE/BOCM/DOGV/BOCYL/DOGC/BOC/BOJA exactos; resto url normalizada). Usar: ensure_convocatoria_documento(conv, boletin_doc_key(url), url, ...).';
