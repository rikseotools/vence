-- 20260725_temario_efectivo.sql
--
-- FASE 3: vista `convocatoria_temario_efectivo` — resuelve qué temario_version se sirve para cada
-- convocatoria, con FALLBACK a la versión anterior (docs/roadmap/temario-versionado-por-convocatoria.md).
-- Espejo SQL de lib/temario/resolveTemarioEfectivo.js (MANTENER EN SYNC).
--
-- Regla: (1) versión propia servible (active|verified) → esa; (2) si no, la default servible más
-- reciente de la oposición (fallback: temario de la convocatoria anterior); (3) si no hay → sin_temario.
-- Aún NO la consume el serving (eso es Fase 4); es la capa de resolución lista para entonces.

CREATE OR REPLACE VIEW convocatoria_temario_efectivo AS
SELECT
  cv.id            AS convocatoria_id,
  cv.oposicion_id  AS oposicion_id,
  COALESCE(
    -- 1) versión propia servible
    (SELECT tv.id FROM temario_versions tv
      WHERE tv.id = cv.temario_version_id AND tv.estado IN ('active','verified')),
    -- 2) fallback: default servible más reciente de la oposición
    (SELECT tv.id FROM temario_versions tv
      WHERE tv.oposicion_id = cv.oposicion_id AND tv.es_default AND tv.estado IN ('active','verified')
      ORDER BY tv.verified_at DESC NULLS LAST, tv.created_at DESC
      LIMIT 1)
  ) AS temario_version_id,
  CASE
    WHEN EXISTS (SELECT 1 FROM temario_versions tv
                 WHERE tv.id = cv.temario_version_id AND tv.estado IN ('active','verified'))
      THEN 'propia'
    WHEN EXISTS (SELECT 1 FROM temario_versions tv
                 WHERE tv.oposicion_id = cv.oposicion_id AND tv.es_default AND tv.estado IN ('active','verified'))
      THEN 'fallback_anterior'
    ELSE 'sin_temario'
  END AS origen
FROM convocatorias cv;

COMMENT ON VIEW convocatoria_temario_efectivo IS
  'Temario efectivo por convocatoria (Fase 3): versión propia servible, o fallback a la default anterior, o sin_temario. Espejo de lib/temario/resolveTemarioEfectivo.js. Aún no consumido por serving (Fase 4).';
