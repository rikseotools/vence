-- 20260728_boletin_doc_key_bopa_bon_bome_docm.sql  [T-221]
--
-- (1) Añade BOPA (Asturias), BON (Navarra), BOME (Melilla) y DOCM (Castilla-La Mancha) a
--     boletin_doc_key(), espejando lib/convocatoria/canonicalizeBoletinUrl.cjs.
-- (2) Añade boletin_doc_key_reconocido(url), que sustituye a la lista de prefijos copiada
--     a mano en cada llamador.
--
-- POR QUÉ AHORA: desde el 28/07 el sensor de boletines emite el enlace del ANUNCIO y no el
-- del sumario del día (antes se perdía al aplanar el HTML). Pero un enlace que este núcleo no
-- reconoce NO deja provenance: el `apply` no registra documento. Medido con la simulación
-- `backend/scripts/sim-enlace-anuncio.ts --con-bd`: 65% de candidatos con enlace y solo 47%
-- llegando a documento, y la diferencia eran justo estos boletines.
--
-- CADA PATRÓN ESTÁ VERIFICADO CONTRA SU URL REAL (regla del núcleo: nada de ids inventados):
--   BOPA  …/bopa/disposiciones?…p_r_p_dispositionReference=2026-06220  → BOPA-2026-06220
--   BON   bon.navarra.es/es/anuncio/-/texto/2026/146/1                 → BON-2026-146-1   (/eu/ converge)
--   BOME  bomemelilla.es/bome/BOME-B-2026-6400/articulo/872            → BOME-A-2026-872
--   DOCM  docm.jccm.es/…?ruta=2026/07/23/pdf/2026_5573.pdf             → DOCM-2026-5573
--   BOC   sede.gobiernodecanarias.org/boc/boc-a-2026-150-2685.pdf      → BOC-2026-150-2685
--         (variante de la SEDE del anuncio que ya reconocíamos como /boc/2026/150/2685.html:
--          los dos salen del mismo sumario y deben CONVERGER, o el hub lo guarda dos veces)
--
-- ⚠️ En el BOME, `BOME-B-…` de la URL es el BOLETÍN del día, no el anuncio: quedarse con él
-- colapsaría todos los anuncios de esa fecha en un mismo doc_key y rompería el dedup del hub.
-- El código del ARTÍCULO (BOME-A-año-N) es el que el portal usa como título de la página.
--
-- DE PASO, ARREGLA UN DRIFT JS↔SQL YA EXISTENTE: el núcleo JS tiene desde la campaña T-107 la
-- variante PDF del eBOJA (…/eboja/AAAA/NNN/BOJAAA-NNN-NNNNN-… → mismo doc_key que la web) y la
-- función en RDS NO la tenía. El test de paridad no lo cazaba porque entre sus fixtures solo
-- estaba la variante web. Se añade la rama y su fixture.
--
-- ⚠️ DOE y BOPV se quedan FUERA a propósito: la URL que publican en su sumario es un
-- envoltorio (el DOE sirve una página de título+analítica sin la disposición; el BOPV mete el
-- texto en un iframe). Reconocerlas crearía provenance apuntando a un caparazón, que es peor
-- que no tener documento. Entrarán cuando se resuelva su URL de contenido real.

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
    -- BOC variante SEDE: sede.gobiernodecanarias.org/boc/boc-a-AAAA-NNN-NNNN.pdf → mismo doc_key
    mm := regexp_match(p_url, 'gobiernodecanarias\.org/boc/boc-[a-z]-([0-9]{4})-([0-9]+)-([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'BOC-' || mm[1] || '-' || mm[2] || '-' || mm[3]; END IF;
    -- BOJA (Andalucía): juntadeandalucia.es/boja/AAAA/NNN/NN → BOJA-AAAA-NNN-NN
    mm := regexp_match(p_url, 'juntadeandalucia\.es/boja/([0-9]{4})/([0-9]+)/([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'BOJA-' || mm[1] || '-' || mm[2] || '-' || mm[3]; END IF;
    -- BOJA variante PDF del eBOJA: .../eboja/AAAA/NNN/BOJAAA-NNN-NNNNN-... → mismo doc_key que la web
    mm := regexp_match(p_url, 'juntadeandalucia\.es/eboja/[0-9]{4}/[0-9]+/BOJA([0-9]{2})-([0-9]+)-([0-9]+)', 'i');
    IF mm IS NOT NULL THEN
      RETURN 'BOJA-20' || mm[1] || '-' || (mm[2])::int || '-' || (mm[3])::int;
    END IF;
    -- DOG (Galicia): xunta.gal/dog/Publicados/AAAA/AAAAMMDD/AnuncioXXXX(_es|_gl).html → DOG-XXXX
    k := (regexp_match(p_url, 'xunta\.gal/dog/Publicados/[0-9]{4}/[0-9]{8}/Anuncio([A-Z0-9-]+?)(?:_[a-z]{2})?\.html', 'i'))[1];
    IF k IS NOT NULL THEN RETURN 'DOG-' || upper(k); END IF;
    -- MIA (portal documental Aragón): por CSV; SPA (?csv=) y API (carp-core-mia .../rest/documentos/CSV/pdf) convergen
    k := (regexp_match(p_url, '(?:mia\.aragon\.es/documentos\?csv=|carp-core-mia\.aragon\.es/rest/documentos/)([A-Z0-9]{10,})', 'i'))[1];
    IF k IS NOT NULL THEN RETURN 'MIA-' || upper(k); END IF;
    -- BOPA (Asturias): …/bopa/disposiciones?…dispositionReference=AAAA-NNNNN → BOPA-AAAA-NNNNN
    k := (regexp_match(p_url, 'miprincipado\.asturias\.es/bopa/.*dispositionReference=([0-9]{4}-[0-9]+)', 'i'))[1];
    IF k IS NOT NULL THEN RETURN 'BOPA-' || k; END IF;
    -- BON (Navarra): bon.navarra.es/{es|eu}/anuncio/-/texto/AAAA/NNN/N → BON-AAAA-NNN-N
    mm := regexp_match(p_url, 'bon\.navarra\.es/[a-z]{2}/anuncio/-/texto/([0-9]{4})/([0-9]+)/([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'BON-' || mm[1] || '-' || mm[2] || '-' || mm[3]; END IF;
    -- BOME (Melilla): bome/BOME-B-AAAA-NNNN/articulo/NNN → BOME-A-AAAA-NNN (el ARTÍCULO, no el boletín)
    mm := regexp_match(p_url, 'bomemelilla\.es/bome/BOME-[A-Z]-([0-9]{4})-[0-9]+/articulo/([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'BOME-A-' || mm[1] || '-' || mm[2]; END IF;
    -- DOCM (Castilla-La Mancha): …?ruta=AAAA/MM/DD/pdf/AAAA_NNNN.pdf → DOCM-AAAA-NNNN
    mm := regexp_match(p_url, 'docm\.jccm\.es/.*ruta=[0-9]{4}/[0-9]{2}/[0-9]{2}/pdf/([0-9]{4})_([0-9]+)', 'i');
    IF mm IS NOT NULL THEN RETURN 'DOCM-' || mm[1] || '-' || mm[2]; END IF;
  END;
  -- reserva: url sin fragmento ni barra final
  RETURN regexp_replace(regexp_replace(btrim(p_url), '#.*$', ''), '/+$', '');
END;
$$;

COMMENT ON FUNCTION boletin_doc_key(text) IS
  'Espejo SQL de lib/convocatoria/canonicalizeBoletinUrl.cjs para el backend. doc_key canónico (BOE/BOCM/DOGV/BOCYL/DOGC/BOC/BOJA/DOG/MIA/BOPA/BON/BOME/DOCM exactos; resto url normalizada). Usar: ensure_convocatoria_documento(conv, boletin_doc_key(url), url, ...).';

-- ¿la URL identifica un DOCUMENTO de un boletín conocido, o solo hemos podido normalizarla?
--
-- Existía como una lista de prefijos ('^(BOE|BOCM|DOGV|…)-') copiada a mano en cada llamador —
-- 3 copias el 28/07, y ninguna se entera de que esta migración añade 4 boletines. Preguntárselo
-- a la función es la única versión que no puede quedarse rancia: `recognized` = la clave NO es
-- la URL de reserva. Espeja el flag `recognized` del núcleo JS.
CREATE OR REPLACE FUNCTION boletin_doc_key_reconocido(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_url IS NOT NULL
     AND btrim(p_url) <> ''
     AND boletin_doc_key(p_url) IS DISTINCT FROM
         regexp_replace(regexp_replace(btrim(p_url), '#.*$', ''), '/+$', '');
$$;

COMMENT ON FUNCTION boletin_doc_key_reconocido(text) IS
  'true si boletin_doc_key() identificó el documento de un boletín conocido (no cayó a la URL de reserva). Úsala en vez de copiar la lista de prefijos: así añadir un boletín no obliga a tocar los llamadores. [T-221]';
