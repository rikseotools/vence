-- 20260709_teoria_content_search.sql
-- ============================================================================
-- Buscador de CONTENIDO para /teoria: full-text search sobre el TEXTO de los
-- artículos (buscar un concepto en toda la legislación, ej. "excedencia
-- voluntaria"). Complementa la búsqueda por nombre de ley (matview
-- mv_teoria_law_catalog).
--
-- Columna propia `teoria_content_tsv` (tsvector precalculado, config
-- spanish_unaccent = stemming español + INSENSIBLE A ACENTOS: "cotizacion"
-- encuentra "cotización"). Precalcularla hace que el ranking (ts_rank) NO
-- recalcule to_tsvector por acierto → rápido incluso para términos comunes.
--
-- ⚠️ NOMBRES AISLADOS a propósito: `articles` ya tiene otra columna FTS,
-- `content_tsv` (config 'spanish', del buscador del CHAT — migración
-- 20260515_articles_fts.sql). Esta usa nombres DISTINTOS (teoria_*) y escribe
-- una columna DISTINTA → los dos triggers coexisten sin pisarse.
--
-- SIN downtime (articles es read-heavy): columna nullable (metadata-only) +
-- trigger + backfill por lotes (script) + índice GIN CONCURRENTLY (script).
-- Reversible: DROP COLUMN teoria_content_tsv + trigger + función (+ config).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Config: 'spanish' + unaccent antes del stemmer (acentos-insensible, pero el
-- documento conserva acentos → snippets bien acentuados).
DROP TEXT SEARCH CONFIGURATION IF EXISTS public.spanish_unaccent;
CREATE TEXT SEARCH CONFIGURATION public.spanish_unaccent (COPY = spanish);
ALTER TEXT SEARCH CONFIGURATION public.spanish_unaccent
  ALTER MAPPING FOR hword, hword_part, word
  WITH extensions.unaccent, spanish_stem;

-- Columna precalculada (nullable → ADD COLUMN es metadata-only, sin reescritura).
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS teoria_content_tsv tsvector;

-- Trigger de mantenimiento. Título con más peso (A) que el cuerpo (B) → los
-- artículos cuyo TÍTULO menciona el término rankean más alto.
CREATE OR REPLACE FUNCTION public.teoria_content_tsv_update()
  RETURNS trigger
  LANGUAGE plpgsql AS
$fn$
BEGIN
  NEW.teoria_content_tsv :=
    setweight(to_tsvector('public.spanish_unaccent', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('public.spanish_unaccent', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS tg_teoria_content_tsv ON public.articles;
CREATE TRIGGER tg_teoria_content_tsv
  BEFORE INSERT OR UPDATE OF title, content ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.teoria_content_tsv_update();

-- Backfill (POR LOTES, fuera de esta migración; ver script de aplicación):
--   UPDATE public.articles SET teoria_content_tsv =
--     setweight(to_tsvector('public.spanish_unaccent', coalesce(title,'')),'A') ||
--     setweight(to_tsvector('public.spanish_unaccent', coalesce(content,'')),'B')
--   WHERE teoria_content_tsv IS NULL   -- en chunks por ctid
--
-- Índice GIN (CONCURRENTLY, fuera de transacción):
--   CREATE INDEX CONCURRENTLY teoria_content_tsv_gin
--     ON public.articles USING gin (teoria_content_tsv)
--     WHERE is_active = true AND content IS NOT NULL;
