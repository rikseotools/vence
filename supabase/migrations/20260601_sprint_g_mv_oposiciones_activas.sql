-- Sprint G.4 — Materialized view mv_oposiciones_activas.
--
-- Pre-JOIN entre oposicion + su convocatoria vigente (is_current=true).
-- Es la fuente preferida para listings públicos: /oposiciones, banner
-- inscription_open, búsqueda. Latencia <5ms incluso con 500+ filas
-- porque es un SELECT sobre tabla materializada con índice por slug.
--
-- Refresh: cada 30 min vía cron NestJS refresh-mv-oposiciones-activas
-- (creado en G.4 backend). REFRESH CONCURRENTLY no bloquea reads.
--
-- Solo incluye oposiciones con is_active=true (visibilidad pública).
-- Las catalogadas con is_active=false (las 103 catalogadas del Sprint A)
-- quedan fuera hasta que el sensor LLM extraiga datos suficientes para
-- que coverage_level suba y is_active se marque true.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_oposiciones_activas AS
SELECT
  o.id,
  o.slug,
  o.nombre,
  o.short_name,
  o.categoria,
  o.administracion,
  o.grupo,
  o.subgrupo,
  o.tipo_acceso,
  o.titulo_requerido,
  o.salario_min,
  o.salario_max,
  o.color_primario,
  o.seo_title,
  o.seo_description,
  o.coverage_level,
  o.fetcher_type,
  o.headless_required,
  o.demand_score,
  o.seguimiento_url AS organismo_url,
  o.temas_count,
  o.bloques_count,
  -- Campos de la convocatoria vigente (NULL si la oposición no tiene)
  c.id                          AS convocatoria_id,
  c.año                         AS convocatoria_año,
  c.convocatoria_numero,
  c.convocatoria_fecha,
  c.convocatoria_dogv,
  c.estado_proceso,
  c.oep_decreto,
  c.oep_fecha,
  c.plazas_libres,
  c.plazas_promocion_interna,
  c.plazas_discapacidad,
  c.boe_publication_date,
  c.boe_reference,
  c.inscription_start,
  c.inscription_deadline,
  c.exam_date,
  c.exam_date_approximate,
  c.programa_url,
  c.examen_config,
  c.landing_faqs,
  c.landing_estadisticas,
  c.landing_description,
  c.requisitos_especiales,
  c.seguimiento_last_checked,
  c.seguimiento_last_hash,
  c.seguimiento_change_status,
  c.seguimiento_change_detected_at
FROM public.oposiciones o
LEFT JOIN public.convocatorias c
  ON c.oposicion_id = o.id
  AND c.is_current = true
WHERE o.is_active = true;

-- UNIQUE index requerido por REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_oposiciones_activas_id
  ON public.mv_oposiciones_activas (id);

CREATE INDEX IF NOT EXISTS idx_mv_oposiciones_activas_slug
  ON public.mv_oposiciones_activas (slug);

CREATE INDEX IF NOT EXISTS idx_mv_oposiciones_activas_estado_proceso
  ON public.mv_oposiciones_activas (estado_proceso);

CREATE INDEX IF NOT EXISTS idx_mv_oposiciones_activas_inscription
  ON public.mv_oposiciones_activas (inscription_start, inscription_deadline)
  WHERE estado_proceso = 'inscripcion_abierta';

CREATE INDEX IF NOT EXISTS idx_mv_oposiciones_activas_demand
  ON public.mv_oposiciones_activas (demand_score DESC NULLS LAST);

-- ============================================================
-- ROLLBACK (descomentar si hace falta)
-- ============================================================
-- DROP MATERIALIZED VIEW IF EXISTS public.mv_oposiciones_activas;
