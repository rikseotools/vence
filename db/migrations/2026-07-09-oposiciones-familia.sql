-- 2026-07-09-oposiciones-familia.sql
-- Familia/vertical profesional como dato de primera clase (taxonomía cerrada).
-- Aditiva y no bloqueante: columna nullable + CHECK + recrear la vista SSOT para
-- exponerla (la vista usa columnas explícitas → no se propaga sola). El backfill y el
-- ingest la pueblan con lib/oposiciones/familia.ts (única fuente de la clasificación).

ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS familia text;

ALTER TABLE oposiciones DROP CONSTRAINT IF EXISTS oposiciones_familia_check;
ALTER TABLE oposiciones ADD CONSTRAINT oposiciones_familia_check
  CHECK (familia IS NULL OR familia IN ('administracion_general','sanidad','educacion','justicia','seguridad','tecnica','social','oficios','otros'));

-- Recrea la vista añadiendo o.familia AL FINAL (CREATE OR REPLACE solo admite
-- columnas nuevas al final; el resto queda idéntico).
CREATE OR REPLACE VIEW oposiciones_ssot AS
 SELECT o.id,
    o.nombre,
    o.tipo_acceso,
    o.administracion,
    o.categoria,
    o.created_at,
    o.slug,
    o.short_name,
    o.grupo,
    COALESCE(c.exam_date, o.exam_date) AS exam_date,
    COALESCE(c.inscription_start, o.inscription_start) AS inscription_start,
    COALESCE(c.inscription_deadline, o.inscription_deadline) AS inscription_deadline,
    COALESCE(c.boe_publication_date, o.boe_publication_date) AS boe_publication_date,
    COALESCE(c.boe_reference, o.boe_reference) AS boe_reference,
    COALESCE(c.plazas_libres, o.plazas_libres) AS plazas_libres,
    COALESCE(c.plazas_promocion_interna, o.plazas_promocion_interna) AS plazas_promocion_interna,
    COALESCE(c.plazas_discapacidad, o.plazas_discapacidad) AS plazas_discapacidad,
    o.temas_count,
    o.bloques_count,
    o.titulo_requerido,
    o.salario_min,
    o.salario_max,
    o.is_active,
    COALESCE(c.is_current AND c.archived_at IS NULL, o.is_convocatoria_activa) AS is_convocatoria_activa,
    COALESCE(c.programa_url, o.programa_url) AS programa_url,
    o.diario_oficial,
    o.diario_referencia,
    o.seguimiento_url,
    o.seguimiento_last_checked,
    o.seguimiento_last_hash,
    o.seguimiento_change_detected_at,
    o.seguimiento_change_status,
    COALESCE(c.landing_description, o.landing_description) AS landing_description,
    o.landing_features,
    o.landing_requirements,
    o.landing_difficulty,
    o.landing_duration,
    COALESCE(c.estado_proceso, o.estado_proceso) AS estado_proceso,
    COALESCE(c.oep_decreto, o.oep_decreto) AS oep_decreto,
    COALESCE(c.oep_fecha, o.oep_fecha) AS oep_fecha,
    COALESCE(c.convocatoria_numero, o.convocatoria_numero) AS convocatoria_numero,
    COALESCE(c.convocatoria_fecha, o.convocatoria_fecha) AS convocatoria_fecha,
    COALESCE(c.convocatoria_dogv, o.convocatoria_dogv) AS convocatoria_dogv,
    COALESCE(c.landing_faqs, o.landing_faqs) AS landing_faqs,
    COALESCE(c.examen_config, o.examen_config) AS examen_config,
    o.color_primario,
    o.seo_title,
    o.seo_description,
    COALESCE(c.requisitos_especiales, o.requisitos_especiales) AS requisitos_especiales,
    COALESCE(c.landing_estadisticas, o.landing_estadisticas) AS landing_estadisticas,
    COALESCE(c.exam_date_approximate, o.exam_date_approximate) AS exam_date_approximate,
    o.subgrupo,
    o.coverage_level,
    o.fetcher_type,
    o.headless_required,
    o.demand_score,
    o.position_group,
    o.familia
   FROM oposiciones o
     LEFT JOIN LATERAL ( SELECT convocatorias.id,
            convocatorias.oposicion_id,
            convocatorias."año",
            convocatorias.convocatoria_numero,
            convocatorias.convocatoria_fecha,
            convocatorias.convocatoria_dogv,
            convocatorias.is_current,
            convocatorias.archived_at,
            convocatorias.estado_proceso,
            convocatorias.oep_decreto,
            convocatorias.oep_fecha,
            convocatorias.plazas_libres,
            convocatorias.plazas_promocion_interna,
            convocatorias.plazas_discapacidad,
            convocatorias.boe_publication_date,
            convocatorias.boe_reference,
            convocatorias.inscription_start,
            convocatorias.inscription_deadline,
            convocatorias.exam_date,
            convocatorias.exam_date_approximate,
            convocatorias.programa_url,
            convocatorias.examen_config,
            convocatorias.landing_faqs,
            convocatorias.landing_estadisticas,
            convocatorias.landing_description,
            convocatorias.requisitos_especiales,
            convocatorias.seguimiento_last_checked,
            convocatorias.seguimiento_last_hash,
            convocatorias.seguimiento_change_status,
            convocatorias.seguimiento_change_detected_at,
            convocatorias.created_at,
            convocatorias.updated_at
           FROM convocatorias
          WHERE convocatorias.oposicion_id = o.id AND convocatorias.is_current = true
         LIMIT 1) c ON true;
