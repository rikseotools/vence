-- Consolidación SSOT — Fase 1: poblar `convocatorias` para TODAS las oposiciones.
-- Antes: solo 92/2.500 oposiciones tenían fila `is_current` en `convocatorias`
-- (snapshot congelado del 01/06) → la vista `oposiciones_ssot` caía al fallback
-- legacy `oposiciones.*` para el 96% del catálogo. Este backfill crea una fila
-- is_current por cada oposición que no la tenía, COPIANDO sus columnas de
-- convocatoria actuales (la vista COALESCE(c,o) devuelve lo MISMO → cero cambio
-- visible; solo pobla la SSOT para que los writers escriban ahí).
--
-- Ejecutado en prod 2026-07-08 (2.408 filas, marker created_at=2026-07-08T13:57:05.210Z).
-- Rollback: DELETE FROM convocatorias WHERE created_at = '2026-07-08T13:57:05.210Z';
-- NO se copian seguimiento_* (metadata del cuerpo, viven en oposiciones por diseño).
-- Ver docs/roadmap/consolidacion-sprint-ejecucion.md §Fase 1.

INSERT INTO convocatorias (
  oposicion_id, "año", is_current, created_at, updated_at,
  convocatoria_numero, convocatoria_fecha, convocatoria_dogv, estado_proceso,
  oep_decreto, oep_fecha, plazas_libres, plazas_promocion_interna, plazas_discapacidad,
  boe_publication_date, boe_reference, inscription_start, inscription_deadline,
  exam_date, exam_date_approximate, programa_url, examen_config,
  landing_faqs, landing_estadisticas, landing_description, requisitos_especiales
)
SELECT
  o.id,
  EXTRACT(YEAR FROM COALESCE(o.oep_fecha, o.convocatoria_fecha, CURRENT_DATE))::int,
  true, now(), now(),
  o.convocatoria_numero, o.convocatoria_fecha, o.convocatoria_dogv, o.estado_proceso,
  o.oep_decreto, o.oep_fecha, o.plazas_libres, o.plazas_promocion_interna, o.plazas_discapacidad,
  o.boe_publication_date, o.boe_reference, o.inscription_start, o.inscription_deadline,
  o.exam_date, o.exam_date_approximate, o.programa_url, o.examen_config,
  o.landing_faqs, o.landing_estadisticas, o.landing_description, o.requisitos_especiales
FROM oposiciones o
WHERE NOT EXISTS (
  SELECT 1 FROM convocatorias c WHERE c.oposicion_id = o.id AND c.is_current = true
)
ON CONFLICT (oposicion_id, "año") DO NOTHING;
