-- Endurecer plazas_total: forma del jsonb impuesta por la BD, tipo honesto y «0 plazas» = desconocido.
--
-- Los tres los destapó una AUDITORÍA ADVERSARIAL del diff anterior (agente fresco, sin contexto de
-- autor), antes de desplegar. Los tres los introduje yo al cablear plazas_otros_turnos a la vista.
--
-- 1) UNA FILA MALA APAGABA LA LANDING ENTERA. `plazas_otros_turnos` es jsonb libre SIN constraint, y
--    lo rellena Claude a mano leyendo boletines. Verificado contra RDS:
--        [{"plazas":"seis"}]      → ERROR: invalid input syntax for type integer: "seis"
--        {"turno":"vg","plazas":6} (objeto, no array) → ERROR: cannot extract elements from an object
--    Antes esa columna NO llegaba a la vista: un dato malo era inocuo. Al meterla, `plazas_total` se
--    computa en CADA fila → una sola fila mal escrita hace fallar la query entera, y
--    getOposicionLandingData tiene `catch → return null`: la landing pierde plazas, fechas, FAQs y SEO
--    de golpe. Y la query del auditor muere igual → el guardarraíl se apaga solo, en silencio.
--    Se impone la forma en la BD (CHECK), como el lifecycle impone su invariante: que el dato malo no
--    pueda ENTRAR, en vez de rezar para que nadie lo escriba.
--
-- 2) «0 plazas» ES UNA MENTIRA, y la migración anterior decía justo eso y no lo cumplía: el CASE solo
--    daba NULL si TODO era NULL. Caso real ya en la BD — auxiliar-administrativo-ics tiene
--    plazas_libres NULL, promoción NULL y plazas_discapacidad=103: en cuanto se marque
--    `plazas_discapacidad_incluidas` (lo correcto para un cupo dentro de un total no registrado), el
--    total daba 0 → y en la landing `plazasTotal ? ... : '—'` con el string "0" es TRUTHY → tarjeta
--    «0 Plazas». NULLIF(...,0): si no suma nada, es que no consta.
--
-- 3) TIPO MENTIROSO. El sum() sobre jsonb es BIGINT y contagia todo el CASE; node-pg entrega los
--    bigint como STRING, pero la landing declara `plazasTotal: number | null`. Hoy se salva de milagro
--    (formatNumber hace toString()), pero la primera comparación o suma que alguien escriba fallará en
--    silencio y el typecheck no verá nada. Es el MISMO bigint que hizo al auditor acusar de mentir a 7
--    tarjetas honestas. ::int (ninguna oposición se acerca a los 2.147M de plazas).
--    CREATE OR REPLACE VIEW no puede cambiar el tipo de una columna existente («cannot change data
--    type of view column»), de ahí el DROP+CREATE. Verificado antes: NADIE depende de la vista.

BEGIN;

CREATE OR REPLACE FUNCTION public.plazas_otros_turnos_bien_formado(j jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT j IS NULL OR (
    jsonb_typeof(j) = 'array'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(j) t
       WHERE jsonb_typeof(t) <> 'object'
          -- 'plazas' debe ser un entero de verdad: es lo que el sum() castea y lo que revienta
          OR coalesce(t->>'plazas', '') !~ '^[0-9]+$'
          -- sin turno no se sabe qué se cuenta; sin cita no se prueba nada (misma doctrina que hitos)
          OR coalesce(t->>'turno', '') = ''
          OR coalesce(t->>'cita', '') = ''
    )
  );
$$;

COMMENT ON FUNCTION public.plazas_otros_turnos_bien_formado IS
  'Forma exigida a plazas_otros_turnos: array de objetos con plazas entera, turno y cita no vacíos. Existe porque la columna la rellena una persona leyendo boletines y un solo valor mal escrito tumbaba oposiciones_ssot —y con ella la landing entera y el propio auditor.';

ALTER TABLE public.convocatorias
  ADD CONSTRAINT chk_plazas_otros_turnos_bien_formado
  CHECK (public.plazas_otros_turnos_bien_formado(plazas_otros_turnos));

DROP VIEW public.oposiciones_ssot;

CREATE VIEW public.oposiciones_ssot AS
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
    NULLIF(CASE
      WHEN COALESCE(c.plazas_libres, o.plazas_libres) IS NULL
       AND COALESCE(c.plazas_promocion_interna, o.plazas_promocion_interna) IS NULL
       AND COALESCE(c.plazas_discapacidad, o.plazas_discapacidad) IS NULL
       AND c.plazas_otros_turnos IS NULL
      THEN NULL
      ELSE COALESCE(COALESCE(c.plazas_libres, o.plazas_libres), 0)
         + COALESCE(COALESCE(c.plazas_promocion_interna, o.plazas_promocion_interna), 0)
         -- El cupo de discapacidad solo suma si es un turno APARTE. Si se reserva DENTRO del libre
         -- (Madrid, Orden 1634/2026: «se reservan 7 del total de las convocadas por el turno libre»)
         -- sumarlo cuenta las mismas plazas dos veces. Ver plazas_discapacidad_incluidas.
         + CASE WHEN c.plazas_discapacidad_incluidas IS TRUE THEN 0
                ELSE COALESCE(COALESCE(c.plazas_discapacidad, o.plazas_discapacidad), 0) END
         + COALESCE((SELECT sum((t->>'plazas')::int)
                       FROM jsonb_array_elements(COALESCE(c.plazas_otros_turnos, '[]'::jsonb)) t), 0)
    END, 0)::int AS plazas_total
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
  'Drop-in de `oposiciones` con los campos temporales resueltos desde la convocatoria vigente + fallback legacy. Los lectores leen de AQUÍ. `plazas_total` es DERIVADO (libre + promoción + discapacidad-si-es-turno-aparte + plazas_otros_turnos), int, y NULL si no consta ninguna cifra o si no suma nada: la landing lo consume como {plazasTotal} para que ninguna tarjeta vuelva a teclear un total a mano.';

COMMIT;
