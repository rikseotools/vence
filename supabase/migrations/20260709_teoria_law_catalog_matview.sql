-- 20260709_teoria_law_catalog_matview.sql
-- ============================================================================
-- Catálogo materializado de leyes de /teoria ("textos legales") + buscador
-- server-side escalable (pg_trgm + unaccent).
--
-- CONTEXTO: /teoria listaba las ~1.139 leyes con teoría como una rejilla sin
-- buscador ni paginación (feedback usuario premium 09/07). El conjunto de leyes
-- mostrado NO era un simple WHERE: lo derivaba fetchLawsList() en JS
-- (>=1 artículo activo con número VÁLIDO; excluye leyes-contenedor de variante
-- "-solo-web"/"-solo-escritorio"). Materializamos esa elegibilidad en SQL como
-- FUENTE ÚNICA (SSOT): listado y buscador leen de la matview, sin duplicar la
-- lógica en dos lenguajes. Paridad verificada: 1.139 filas == salida de
-- fetchLawsList a 2026-07-09.
--
-- Aditiva y reversible: DROP MATERIALIZED VIEW mv_teoria_law_catalog (+ función)
-- restaura el estado anterior. No toca tablas existentes.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() es STABLE (depende del diccionario) → no es indexable directamente.
-- Envoltura IMMUTABLE fijando el diccionario, patrón estándar para indexar sobre
-- texto sin acentos. STRICT: NULL -> NULL.
-- La extensión unaccent vive en el schema `extensions` en este entorno; se
-- cualifica el diccionario para no depender del search_path (requisito para
-- que la función sea legítimamente IMMUTABLE e indexable).
CREATE OR REPLACE FUNCTION public.immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $func$
  SELECT extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$func$;

DROP MATERIALIZED VIEW IF EXISTS public.mv_teoria_law_catalog;

CREATE MATERIALIZED VIEW public.mv_teoria_law_catalog AS
WITH base AS (
  SELECT
    l.id          AS law_id,
    l.short_name  AS short_name,
    l.name        AS name,
    l.description AS description,
    l.slug        AS slug,
    -- article_count = nº de artículos con número VÁLIDO (numérico + bis/ter/...
    -- o disposición DA/DT/DD/DF). Reproduce isValidArticleNumber/isDisposicionArticle.
    count(*) FILTER (
      WHERE a.article_number ~* '^[0-9]+( *(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|novies|decies|undecies|duodecies))?( +[0-9]+)?$'
         OR a.article_number ~* '^(DA|DT|DD|DF)'
    )::int AS article_count
  FROM public.laws l
  JOIN public.articles a
    ON a.law_id = l.id
   AND a.is_active = true
   AND a.content IS NOT NULL
  WHERE l.is_active = true
  GROUP BY l.id, l.short_name, l.name, l.description, l.slug
)
SELECT
  base.law_id,
  base.short_name,
  base.name,
  base.description,
  base.slug,
  base.article_count,
  -- Texto normalizado para búsqueda difusa: minúsculas + sin acentos.
  public.immutable_unaccent(
    lower(coalesce(base.short_name, '') || ' ' || coalesce(base.name, '') || ' ' || coalesce(base.description, ''))
  ) AS search_text
FROM base
WHERE base.article_count > 0
  -- Excluir leyes-contenedor de variante (isVariantContainerLaw).
  AND (base.slug IS NULL OR (base.slug NOT LIKE '%-solo-escritorio' AND base.slug NOT LIKE '%-solo-web'));

-- Unique index sobre law_id → habilita REFRESH MATERIALIZED VIEW CONCURRENTLY
-- (refresco sin bloquear lecturas).
CREATE UNIQUE INDEX mv_teoria_law_catalog_pk
  ON public.mv_teoria_law_catalog (law_id);

-- Orden por defecto del listado: más artículos primero, desempate estable por nombre.
CREATE INDEX mv_teoria_law_catalog_order
  ON public.mv_teoria_law_catalog (article_count DESC, short_name);

-- Búsqueda difusa / substring acelerada por trigramas.
CREATE INDEX mv_teoria_law_catalog_trgm
  ON public.mv_teoria_law_catalog USING gin (search_text gin_trgm_ops);
