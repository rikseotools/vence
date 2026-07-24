-- 20260725_boletin_doc_key.sql
--
-- boletin_doc_key(url) — versión SQL del canonicalizador, para que el BACKEND (NestJS, que no
-- alcanza lib/ de la raíz) pueda enrutar sus clonados por ensure_convocatoria_documento sin
-- duplicar el canonicalizador en TS. Espeja lib/convocatoria/canonicalizeBoletinUrl.cjs:
-- boletines RECONOCIDOS (BOE/BOCM) → id exacto (idéntico al JS, es el caso que importa: mata
-- el dup txt.php vs /pdfs). No reconocidos → url sin fragmento ni barra final (best-effort;
-- puede diferir del JS en case de host/orden de query → a lo sumo una fila duplicada de un PDF
-- oscuro clonado por dos vías, nunca corrupción). IMMUTABLE (pura).
--
-- Cross-check JS↔SQL para los reconocidos: __tests__/... (fixture compartido) + verificación en RDS.

CREATE OR REPLACE FUNCTION boletin_doc_key(p_url text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  k text;
BEGIN
  IF p_url IS NULL OR btrim(p_url) = '' THEN RETURN NULL; END IF;
  -- BOE-A/B/S-AAAA-N (disposiciones/anuncios/sumarios)
  k := (regexp_match(p_url, 'BOE-[ABS]-[0-9]{4}-[0-9]+', 'i'))[1];
  IF k IS NOT NULL THEN RETURN upper(k); END IF;
  -- BOCM-AAAAMMDD-N
  k := (regexp_match(p_url, 'BOCM-[0-9]{8}-[0-9]+', 'i'))[1];
  IF k IS NOT NULL THEN RETURN upper(k); END IF;
  -- reserva: url sin fragmento ni barra final
  RETURN regexp_replace(regexp_replace(btrim(p_url), '#.*$', ''), '/+$', '');
END;
$$;

COMMENT ON FUNCTION boletin_doc_key(text) IS
  'Espejo SQL de lib/convocatoria/canonicalizeBoletinUrl.cjs para el backend. doc_key canónico (BOE/BOCM exactos; resto url normalizada). Usar: ensure_convocatoria_documento(conv, boletin_doc_key(url), url, ...).';
