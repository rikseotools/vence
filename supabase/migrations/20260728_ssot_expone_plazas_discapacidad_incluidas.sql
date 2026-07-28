-- `oposiciones_ssot` EXPONE `plazas_discapacidad_incluidas`.
--
-- La columna ya la USABA la vista —dentro del CASE que deriva `plazas_total`— pero solo en el
-- LATERAL: nunca se proyectaba. Al cablear la frase de reserva en la landing (T-214), la query de
-- `getOposicionLandingData` empezó a pedirla a la vista y Postgres respondió
-- `42703 column "plazas_discapacidad_incluidas" does not exist`.
--
-- Lo grave no es el error, es DÓNDE cae: `getOposicionLandingData` envuelve la query en
-- try/catch → `console.warn` + `return null`, y `getOposicionLandingDataCached` cachea ese null.
-- O sea, las 123 landings activas se quedarían A LA VEZ sin plazas, sin fecha de examen, sin
-- plazos, sin BOE, sin seo_title/description, sin FAQs y sin estadísticas —cayendo al texto
-- genérico de config— y NADA avisaría: sin ❌, sin 5xx, sin badge. El mismo modo de fallo
-- silencioso que la migración 20260716 (`plazas_total`) documenta y que le costó al proyecto una
-- auditoría adversarial descubrir.
--
-- Semántica: se expone `c.plazas_discapacidad_incluidas` TAL CUAL, sin COALESCE a `oposiciones`
-- —esa tabla no tiene la columna, el dato solo existe a nivel de convocatoria— y sobre todo sin
-- traducir el NULL a un valor por defecto. Es exactamente la misma expresión que consume el CASE
-- de `plazas_total`, y eso es deliberado: si el render decidiera con un dato y el total con otro,
-- la misma página se contradiría. `null` significa «no consta» y el consumidor decide qué hace con
-- ello (la vista suma, la frase calla; ver lib/convocatoria/reservaDiscapacidad.ts §«Ojo»).
--
-- `CREATE OR REPLACE VIEW` basta: solo se AÑADE una columna al final, que es la única forma de
-- cambio que Postgres permite sin DROP. Aditivo y reversible; ningún lector existente cambia.

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
    c.plazas_otros_turnos,
    NULLIF(CASE
      WHEN COALESCE(c.plazas_libres, o.plazas_libres) IS NULL
       AND COALESCE(c.plazas_promocion_interna, o.plazas_promocion_interna) IS NULL
       AND COALESCE(c.plazas_discapacidad, o.plazas_discapacidad) IS NULL
       AND c.plazas_otros_turnos IS NULL
      THEN NULL
      ELSE COALESCE(COALESCE(c.plazas_libres, o.plazas_libres), 0)
         + COALESCE(COALESCE(c.plazas_promocion_interna, o.plazas_promocion_interna), 0)
         + CASE WHEN c.plazas_discapacidad_incluidas IS TRUE THEN 0
                ELSE COALESCE(COALESCE(c.plazas_discapacidad, o.plazas_discapacidad), 0) END
         + COALESCE((SELECT sum((t->>'plazas')::int)
                       FROM jsonb_array_elements(COALESCE(c.plazas_otros_turnos, '[]'::jsonb)) t), 0)
    END, 0)::int AS plazas_total,
    -- ── AÑADIDA AL FINAL (única forma que admite CREATE OR REPLACE VIEW).
    -- ¿El cupo de discapacidad va DENTRO del turno libre (true), APARTE (false) o no consta (null)?
    -- Misma expresión que consume el CASE de plazas_total, justo arriba: una sola verdad.
    c.plazas_discapacidad_incluidas
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
            convocatorias.plazas_discapacidad_incluidas,
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
  'Drop-in de `oposiciones` con los campos temporales resueltos desde la convocatoria vigente + fallback legacy. Los lectores leen de AQUÍ. `plazas_total` es DERIVADO (libre + promoción + discapacidad-si-es-turno-aparte + plazas_otros_turnos), int, y NULL si no consta ninguna cifra o si no suma nada. `plazas_discapacidad_incluidas` se expone tal cual (true=dentro, false=aparte, null=no consta) para que el texto de la landing y el total salgan del MISMO dato.';

COMMIT;
