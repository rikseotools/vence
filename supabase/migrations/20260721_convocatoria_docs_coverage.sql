-- convocatoria_docs_coverage — VISTA de cobertura de provenance de documentos.
--
-- PROBLEMA que resuelve (medido 21/07/2026): se clonan documentos a
-- `convocatoria_documentos` (mayormente `nota` automáticas del pipeline
-- detect-notas), pero NADIE trackea qué documentos REFERENCIA un proceso (los
-- hitos del timeline que citan BOE/boletines) vs cuáles están de verdad clonados
-- y ENLAZADOS. Resultado: de 1.044 hitos solo 18 tenían `source_documento_id`;
-- 260 apuntaban por URL a un documento oficial sin clonar; 22 citas literales
-- sin documento fuente. La provenance ("cada dato apunta a su documento-fuente")
-- estaba rota y era invisible. Diseño: docs/roadmap/verificacion-convocatorias-documentos-proceso.md
--
-- Esta vista es la FUENTE ÚNICA de la cobertura. La leen:
--   - el sweep de salud (kind `convocatoria_docs_incompletos`) → content_health_findings,
--   - el backfill de enlaces (link determinista por URL),
--   - /admin (cuando se cablee la superficie).
--
-- Escalable: corpus pequeño (≈350 convocatorias, ≈1.500 docs, ≈1.000 hitos);
-- se agrega en 2 scans (hitos, documentos) — no correlated-subquery por fila.
--
-- Semántica de los huecos (por convocatoria):
--   docs_clonados        = filas en convocatoria_documentos
--   hitos_con_url        = hitos que apuntan a un documento oficial (tienen url)
--   hitos_enlazados      = hitos con source_documento_id (provenance completa)
--   hitos_enlazables     = url coincide con un doc YA clonado, pero sin enlace  → backfill SIN fetch
--   docs_por_clonar      = url NO coincide con ningún doc clonado               → hay que clonar (fetch oficial)
--   citas_sin_fuente     = cita_literal sin source_documento_id                 → provenance de la cita rota
--   incompleto           = hay trabajo accionable de provenance en esta convocatoria

CREATE OR REPLACE VIEW convocatoria_docs_coverage AS
WITH doc_counts AS (
  SELECT convocatoria_id, count(*)::int AS docs_clonados
  FROM convocatoria_documentos
  WHERE convocatoria_id IS NOT NULL
  GROUP BY convocatoria_id
),
hito_stats AS (
  SELECT
    h.convocatoria_id,
    count(*) FILTER (WHERE h.url IS NOT NULL)::int AS hitos_con_url,
    count(*) FILTER (WHERE h.source_documento_id IS NOT NULL)::int AS hitos_enlazados,
    count(*) FILTER (
      WHERE h.url IS NOT NULL AND h.source_documento_id IS NULL AND md.id IS NOT NULL
    )::int AS hitos_enlazables,
    count(*) FILTER (
      WHERE h.url IS NOT NULL AND h.source_documento_id IS NULL AND md.id IS NULL
    )::int AS docs_por_clonar,
    count(*) FILTER (
      WHERE h.cita_literal IS NOT NULL
        AND length(btrim(h.cita_literal)) > 0
        AND h.source_documento_id IS NULL
    )::int AS citas_sin_fuente
  FROM convocatoria_hitos h
  -- ¿la url del hito coincide con un documento YA clonado en la misma convocatoria?
  LEFT JOIN LATERAL (
    SELECT d.id
    FROM convocatoria_documentos d
    WHERE d.convocatoria_id = h.convocatoria_id
      AND d.url = h.url
    LIMIT 1
  ) md ON h.url IS NOT NULL
  WHERE h.convocatoria_id IS NOT NULL
  GROUP BY h.convocatoria_id
)
SELECT
  c.id            AS convocatoria_id,
  c.oposicion_id,
  o.slug,
  o.is_active,
  c.is_current,
  c.año,
  COALESCE(dc.docs_clonados, 0)   AS docs_clonados,
  COALESCE(hs.hitos_con_url, 0)   AS hitos_con_url,
  COALESCE(hs.hitos_enlazados, 0) AS hitos_enlazados,
  COALESCE(hs.hitos_enlazables, 0) AS hitos_enlazables,
  COALESCE(hs.docs_por_clonar, 0) AS docs_por_clonar,
  COALESCE(hs.citas_sin_fuente, 0) AS citas_sin_fuente,
  (
    COALESCE(hs.docs_por_clonar, 0) > 0
    OR COALESCE(hs.hitos_enlazables, 0) > 0
    OR COALESCE(hs.citas_sin_fuente, 0) > 0
  ) AS incompleto
FROM convocatorias c
JOIN oposiciones o ON o.id = c.oposicion_id
LEFT JOIN doc_counts dc ON dc.convocatoria_id = c.id
LEFT JOIN hito_stats hs ON hs.convocatoria_id = c.id;

COMMENT ON VIEW convocatoria_docs_coverage IS
  'Cobertura de provenance de documentos por convocatoria: clonados vs referenciados (hitos con url) vs enlazados, con desglose de huecos (enlazables por URL sin fetch, por clonar, citas sin fuente). Fuente única del kind convocatoria_docs_incompletos del sweep. Diseño: docs/roadmap/verificacion-convocatorias-documentos-proceso.md';
