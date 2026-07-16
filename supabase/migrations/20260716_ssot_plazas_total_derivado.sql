-- La tarjeta de la landing no puede volver a mentir: el TOTAL se deriva, no se teclea.
--
-- HALLAZGO (16/07/2026, triaje de tarjetas): la landing de `celador-sescam-clm` anunciaba
-- «537 plazas totales». El decreto oficial (DOCM nº 240 de 12/12/2025, NID 2025/9540, clonado en el
-- corpus como DOCM-240-2025-9540) dice, con cabeceras:
--     Agrupaciones profesionales · Celador/a · Cupo general 115 · Reserva discapacidad 6 · 3
--     (2ª tabla, promoción interna) · Celador/a · 4
-- → 115 + 4 + 9 = 128. El 537 NO APARECE en el documento. Nuestras COLUMNAS eran correctas
-- (115/4/9); mentía solo la tarjeta, porque `landing_estadisticas` es JSONB de texto libre donde
-- alguien escribió un número a mano y ese número no se entera de nada cuando el dato cambia.
--
-- POR QUÉ ESTA MIGRACIÓN Y NO UN UPDATE DEL 537: cambiar 537→128 arregla UNA tarjeta y deja la
-- máquina de mentir intacta. El renderizador (app/[oposicion]/page.tsx) ya resuelve `{plazasLibres}`,
-- `{temasCount}`… contra la BD: esas tarjetas NO PUEDEN driftar. Faltaba la variable del total, que es
-- justo la que la gente teclea a mano. Se expone aquí, DERIVADA, y las tarjetas pasan a usarla.
--
-- SEGUNDO CABO SUELTO QUE CIERRA: `convocatorias.plazas_otros_turnos` (el 4º turno, migración
-- 20260716_convocatoria_otros_turnos.sql) existía pero NO llegaba a la vista → la landing no podía
-- verlo. Hoy solo administrativo-navarra lo usa (6 plazas de violencia de género): sin esta columna,
-- un `{plazasTotal}` calculado en la landing habría mostrado 579 en vez de 585, reintroduciendo en la
-- landing EXACTAMENTE el bug que aquella migración arregló en la BD.
--
-- NULL SE QUEDA NULL: si no consta ninguna cifra, el total es NULL (desconocido), no 0. Una tarjeta
-- que anuncia «0 plazas» miente igual que una que anuncia 537.

BEGIN;

CREATE OR REPLACE VIEW public.oposiciones_ssot AS
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
    o.familia,
    -- ── AÑADIDAS AL FINAL (CREATE OR REPLACE VIEW solo permite añadir columnas al final).
    -- Sin contraparte legacy en `oposiciones`: el 4º turno solo existe en `convocatorias`.
    c.plazas_otros_turnos,
    -- El total del proceso, DERIVADO. Espejo en SQL de public.convocatoria_plazas_total(), que aquí
    -- no se puede invocar: la función recibe un convocatoria_id y esta vista debe resolver también
    -- las oposiciones que aún tiran del legacy (c.* NULL). Misma aritmética, mismo criterio.
    CASE
      WHEN COALESCE(c.plazas_libres, o.plazas_libres) IS NULL
       AND COALESCE(c.plazas_promocion_interna, o.plazas_promocion_interna) IS NULL
       AND COALESCE(c.plazas_discapacidad, o.plazas_discapacidad) IS NULL
       AND c.plazas_otros_turnos IS NULL
      THEN NULL
      ELSE COALESCE(COALESCE(c.plazas_libres, o.plazas_libres), 0)
         + COALESCE(COALESCE(c.plazas_promocion_interna, o.plazas_promocion_interna), 0)
         + COALESCE(COALESCE(c.plazas_discapacidad, o.plazas_discapacidad), 0)
         + COALESCE((SELECT sum((t->>'plazas')::int)
                       FROM jsonb_array_elements(COALESCE(c.plazas_otros_turnos, '[]'::jsonb)) t), 0)
    END AS plazas_total
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
            convocatorias.plazas_otros_turnos,
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

COMMENT ON VIEW public.oposiciones_ssot IS
  'Drop-in de `oposiciones` con los campos temporales resueltos desde la convocatoria vigente + fallback legacy. Los lectores leen de AQUÍ. `plazas_total` es DERIVADO (3 turnos comunes + plazas_otros_turnos) y NULL si no consta ninguna cifra: la landing lo consume como {plazasTotal} para que ninguna tarjeta vuelva a teclear un total a mano.';

COMMIT;
