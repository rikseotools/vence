-- Consolidación SSOT — Fase 1: poblar `convocatorias` desde `oposiciones` (§G.2.1).
-- Antes: solo 92/2.500 oposiciones tenían fila `is_current` en `convocatorias`
-- (snapshot congelado del 01/06) → la vista `oposiciones_ssot` caía al fallback
-- legacy `oposiciones.*` para el 96% del catálogo. Crea la fila de convocatoria
-- vigente por cada oposición con proceso real, con `año`/`is_current`/`archived_at`
-- según el estado del proceso. La vista COALESCE(c,o) devuelve lo MISMO → cero
-- cambio visible; solo pobla la SSOT (prerrequisito del drop de Fase 5).
--
-- Conforme a docs/roadmap/sprint-g-oposiciones-vs-convocatorias.md §G.2.1.
-- DESVIACIÓN DELIBERADA vs G.2.1: NO se copian `seguimiento_*` — el diseño VIVO
-- (consolidacion-convocatorias-radar-ssot.md §4 Fase 2) los mantiene en
-- `oposiciones` (la vista no los resuelve de convocatorias). Es lo correcto hoy.
--
-- Aplicado a prod 2026-07-08 (2.408 filas, marker created_at=2026-07-08T13:57:05.210Z).
-- NOTA: la 1ª pasada usó año=oep_fecha e is_current=true sin archived_at; se
-- corrigió in situ a esta versión (25 años + 74 archived_at) el mismo día.
-- Rollback: re-null hitos.convocatoria_id de estas filas y
--   DELETE FROM convocatorias WHERE created_at = '2026-07-08T13:57:05.210Z';

INSERT INTO convocatorias (
  oposicion_id, "año", is_current, archived_at, created_at, updated_at,
  convocatoria_numero, convocatoria_fecha, convocatoria_dogv, estado_proceso,
  oep_decreto, oep_fecha, plazas_libres, plazas_promocion_interna, plazas_discapacidad,
  boe_publication_date, boe_reference, inscription_start, inscription_deadline,
  exam_date, exam_date_approximate, programa_url, examen_config,
  landing_faqs, landing_estadisticas, landing_description, requisitos_especiales
)
SELECT
  o.id,
  -- año = de la CONVOCATORIA (no de la OEP): convocatoria_fecha → exam_date → 2026
  COALESCE(EXTRACT(YEAR FROM o.convocatoria_fecha)::int,
           EXTRACT(YEAR FROM o.exam_date)::int, 2026),
  -- is_current: false si es un slug de año pasado ya inactivo, si no true
  CASE WHEN o.slug ~ '-[0-9]{4}$' AND o.is_active = false THEN false ELSE true END,
  -- archived_at: solo si el proceso está cerrado/superado
  CASE WHEN o.is_active = false
        AND o.estado_proceso IN ('examen_realizado','resultados','nombramientos')
       THEN COALESCE(o.exam_date::timestamptz, now()) ELSE NULL END,
  now(), now(),
  o.convocatoria_numero, o.convocatoria_fecha, o.convocatoria_dogv, o.estado_proceso,
  o.oep_decreto, o.oep_fecha, o.plazas_libres, o.plazas_promocion_interna, o.plazas_discapacidad,
  o.boe_publication_date, o.boe_reference, o.inscription_start, o.inscription_deadline,
  o.exam_date, o.exam_date_approximate, o.programa_url, o.examen_config,
  o.landing_faqs, o.landing_estadisticas, o.landing_description, o.requisitos_especiales
FROM oposiciones o
WHERE (
  o.estado_proceso IS NOT NULL OR o.convocatoria_fecha IS NOT NULL
  OR o.exam_date IS NOT NULL OR o.plazas_libres IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM convocatorias c WHERE c.oposicion_id = o.id AND c.is_current = true
)
ON CONFLICT (oposicion_id, "año") DO NOTHING;
