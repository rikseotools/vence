-- 20260727_docs_coverage_excluye_estimaciones.sql
--
-- `convocatoria_docs_coverage.citas_sin_fuente` contaba TODO hito con cita literal y sin
-- `source_documento_id`, incluidos los de `origen='estimacion'`. Eso es una contradicción de
-- categoría: una estimación es, por definición, una fecha NUESTRA que ningún boletín publica —
-- exigirle un documento oficial es pedir la prueba de algo que declaramos no probado.
--
-- Efecto práctico (medido 27/07/2026 al cerrar la landing de `ordenanza-ayuntamiento-cordoba`
-- antes de su campaña): esa convocatoria quedaba marcada `incompleto` para siempre por un solo
-- hito —"Celebración de los ejercicios (fecha por determinar)"— cuya cita dice justamente que
-- no hay fecha oficial. Un aviso que NO se puede apagar haciendo lo correcto es ruido, y el
-- ruido acaba tapando los 4 hitos que sí tenían documento que clonar.
--
-- Alcance real de la corrección (activas + vigentes, 27/07/2026): 2 hitos `estimacion` de todo
-- el catálogo; las convocatorias con `docs_por_clonar`/`hitos_enlazables` > 0 siguen marcadas
-- igual. Es precisión, no amnistía: los hitos `registro` (5) e `inferencia` (4) sin fuente
-- siguen contando, que son los que sí tienen un documento detrás que nadie ha clonado.
--
-- Idempotente (CREATE OR REPLACE). Consumidores: kind `convocatoria_docs_incompletos` del
-- barrido de salud y `npm run audit:landing`. Ver docs/runbooks/provenance-convocatorias.md.

CREATE OR REPLACE VIEW convocatoria_docs_coverage AS
WITH doc_counts AS (
  SELECT convocatoria_documentos.convocatoria_id,
         count(*)::integer AS docs_clonados
    FROM convocatoria_documentos
   WHERE convocatoria_documentos.convocatoria_id IS NOT NULL
   GROUP BY convocatoria_documentos.convocatoria_id
), hito_stats AS (
  SELECT h.convocatoria_id,
         count(*) FILTER (WHERE h.url IS NOT NULL)::integer AS hitos_con_url,
         count(*) FILTER (WHERE h.source_documento_id IS NOT NULL)::integer AS hitos_enlazados,
         count(*) FILTER (WHERE h.url IS NOT NULL AND h.source_documento_id IS NULL AND md.id IS NOT NULL)::integer AS hitos_enlazables,
         count(*) FILTER (WHERE h.url IS NOT NULL AND h.source_documento_id IS NULL AND md.id IS NULL)::integer AS docs_por_clonar,
         count(*) FILTER (
           WHERE h.cita_literal IS NOT NULL
             AND length(btrim(h.cita_literal)) > 0
             AND h.source_documento_id IS NULL
             -- una estimación declara que NO tiene fuente oficial: no se le exige documento
             AND h.origen IS DISTINCT FROM 'estimacion'
         )::integer AS citas_sin_fuente
    FROM convocatoria_hitos h
    LEFT JOIN LATERAL (
      SELECT d.id FROM convocatoria_documentos d
       WHERE d.convocatoria_id = h.convocatoria_id AND d.url = h.url
       LIMIT 1
    ) md ON h.url IS NOT NULL
   WHERE h.convocatoria_id IS NOT NULL
   GROUP BY h.convocatoria_id
)
SELECT c.id AS convocatoria_id,
       c.oposicion_id,
       o.slug,
       o.is_active,
       c.is_current,
       c."año",
       COALESCE(dc.docs_clonados, 0) AS docs_clonados,
       COALESCE(hs.hitos_con_url, 0) AS hitos_con_url,
       COALESCE(hs.hitos_enlazados, 0) AS hitos_enlazados,
       COALESCE(hs.hitos_enlazables, 0) AS hitos_enlazables,
       COALESCE(hs.docs_por_clonar, 0) AS docs_por_clonar,
       COALESCE(hs.citas_sin_fuente, 0) AS citas_sin_fuente,
       COALESCE(hs.docs_por_clonar, 0) > 0
         OR COALESCE(hs.hitos_enlazables, 0) > 0
         OR COALESCE(hs.citas_sin_fuente, 0) > 0 AS incompleto
  FROM convocatorias c
  JOIN oposiciones o ON o.id = c.oposicion_id
  LEFT JOIN doc_counts dc ON dc.convocatoria_id = c.id
  LEFT JOIN hito_stats hs ON hs.convocatoria_id = c.id;
