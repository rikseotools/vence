-- 20260725_temario_versions_fase1.sql
--
-- FASE 1 del diseño "temario versionado por convocatoria"
-- (docs/roadmap/temario-versionado-por-convocatoria.md). Solo MODELO — no cambia serving.
--
-- El temario pasa a ser una entidad versionada (`temario_versions`) que las convocatorias
-- referencian. Migración backward-compatible: 1 versión `active`+default por oposición → como
-- `position_type` sigue resolviendo 1:1, los ~56 lectores legacy no cambian nada.
--
-- Todo ADITIVO (columnas nullable; se pueblan en el backfill scripts/temario/backfill-temario-versions.cjs).

-- 1) La versión de temario (entidad de primera clase)
CREATE TABLE IF NOT EXISTS temario_versions (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oposicion_id           uuid NOT NULL REFERENCES oposiciones(id),
  label                  text,                              -- p.ej. "2024", "OEP 2023", "base"
  estado                 text NOT NULL DEFAULT 'active',    -- draft|verified|active|superseded
  es_default             boolean NOT NULL DEFAULT false,    -- la que sirve la vía legacy (is_active)
  source_convocatoria_id uuid REFERENCES convocatorias(id), -- convocatoria que estrenó la versión
  source_documento_id    uuid REFERENCES convocatoria_documentos(id), -- doc oficial clonado (hub T-107)
  parent_version_id      uuid REFERENCES temario_versions(id),        -- linaje (de qué versión se copió)
  verified_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT temario_versions_estado_check CHECK (estado IN ('draft','verified','active','superseded'))
);

COMMENT ON TABLE temario_versions IS
  'Versión del temario de una oposición (Fase 1 de temario-versionado-por-convocatoria). Las convocatorias la referencian; varias comparten versión si el temario es igual. es_default = la servible por la vía legacy (is_active).';

-- Invariante: a lo sumo UNA versión default por oposición (evita ambigüedad de serving legacy).
CREATE UNIQUE INDEX IF NOT EXISTS ux_temario_version_default
  ON temario_versions (oposicion_id) WHERE es_default;

CREATE INDEX IF NOT EXISTS idx_temario_versions_oposicion ON temario_versions (oposicion_id);

-- 2) topics pertenece a una versión (nullable hasta el backfill)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS temario_version_id uuid REFERENCES temario_versions(id);
CREATE INDEX IF NOT EXISTS idx_topics_temario_version ON topics (temario_version_id);

COMMENT ON COLUMN topics.temario_version_id IS
  'Versión de temario a la que pertenece este tema. En Fase 1 hay 1 versión default por oposición → position_type sigue resolviendo 1:1. is_active = pertenece a la versión servible por defecto.';

-- 3) convocatorias apunta a la versión de temario que usa (nullable hasta el backfill)
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS temario_version_id uuid REFERENCES temario_versions(id);

COMMENT ON COLUMN convocatorias.temario_version_id IS
  'Versión de temario que usa esta convocatoria. Varias convocatorias pueden compartir versión (temario estable). NULL → resuelve por fallback (vista temario_efectivo).';
