-- I10_inscripcion_sin_convocatoria — invariante nuevo de timeline de convocatorias (T-124).
--
-- ## El punto ciego que cierra
--
-- `convocatoria_hito_incidencias` reunía 7 invariantes (I1, I2, I5-I9) y TODOS miraban filas
-- de `convocatoria_hitos`. Ninguno miraba las columnas `inscription_start` /
-- `inscription_deadline` de `convocatorias`, así que una convocatoria SIN PUBLICAR que
-- arrastra fechas de inscripción ya pasadas era invisible para el sweep de salud.
--
-- Caso real (26/07/2026, `administrativo-pais-vasco`): la convocatoria vigente está en
-- `estado_proceso='oep_aprobada'` con `plazas_prevision=true`, su propio
-- `plazas_prevision_motivo` dice literalmente "la convocatoria NO existe todavía", y su hito
-- `convocatoria_publicada` está `upcoming` el 31/08/2026 — pero la fila cargaba
-- `inscription_start=05/05/2026` e `inscription_deadline=01/06/2026`. Resultado EN VIVO: la
-- landing anunciaba **"Plazo de inscripción cerrado."** en una oposición que aún no se ha
-- convocado. El usuario lee que ha perdido el plazo y se va, cuando no ha perdido nada.
--
-- ## Por qué este predicado
--
-- No necesita conocimiento externo: es una contradicción de la fila CONSIGO MISMA. Si la
-- publicación de la convocatoria está en el futuro (o las plazas son una previsión
-- declarada), no puede haber existido un plazo de solicitudes que ya cerró.
--
-- Calibrado contra RDS ANTES de crearlo: **1 sola coincidencia en todo el banco** (el caso
-- real). Un detector que se enciende en 300 sitios es ruido, no observabilidad.
--
-- ## Cómo se construyó esta migración (importante para la siguiente)
--
-- El cuerpo de las 7 ramas previas es la salida VERBATIM de
-- `pg_get_viewdef('convocatoria_hito_incidencias', true)`, no una transcripción a mano: al
-- reescribirlas de memoria salieron mal I1, I2 e I9 (p.ej. el I9 real compara `titulo`, no
-- `cita_literal`), lo que habría cambiado tres invariantes EN SILENCIO. Si hay que volver a
-- tocar la vista, volcarla otra vez y añadir ramas al final.
--
-- Aditivo: solo añade una rama al UNION ALL. `hito_id` va NULL porque el hallazgo es de la
-- fila de `convocatorias`, no de un hito concreto; los consumidores filtran por `invariante`.

CREATE OR REPLACE VIEW convocatoria_hito_incidencias AS
 SELECT h1.convocatoria_id,
    h1.id AS hito_id,
    'I1_orden'::text AS invariante,
    format('%s (%s) es posterior a %s (%s)'::text, h1.tipo, h1.fecha, h2.tipo, h2.fecha) AS detalle
   FROM convocatoria_hitos h1
     JOIN convocatoria_hitos h2 ON h2.convocatoria_id = h1.convocatoria_id AND h1.fecha > h2.fecha
  WHERE h1.tipo = 'plazo_inicio'::text AND h2.tipo = 'plazo_fin'::text OR h1.tipo = 'plazo_fin'::text AND h2.tipo = 'ejercicio_1'::text OR h1.tipo = 'ejercicio_1'::text AND h2.tipo = 'resultados'::text
UNION ALL
 SELECT h.convocatoria_id,
    (array_agg(h.id ORDER BY h.fecha))[1] AS hito_id,
    'I2_duplicado'::text AS invariante,
    format('%s "%s" aparece %s veces con fechas distintas'::text, h.tipo, min(h.titulo), count(*)) AS detalle
   FROM convocatoria_hitos h
  WHERE h.tipo = ANY (ARRAY['ejercicio_1'::text, 'plazo_inicio'::text, 'plazo_fin'::text])
  GROUP BY h.convocatoria_id, h.tipo, (lower(regexp_replace(COALESCE(h.titulo, ''::text), '\s+'::text, ' '::text, 'g'::text)))
 HAVING count(DISTINCT h.fecha) > 1
UNION ALL
 SELECT h.convocatoria_id,
    h.id AS hito_id,
    'I9_tipo_incoherente'::text AS invariante,
    format('tipo=%s contradice el título "%s"'::text, h.tipo, h.titulo) AS detalle
   FROM convocatoria_hitos h
  WHERE h.tipo = 'plazo_inicio'::text AND h.titulo ~* 'cierre|clausura|fin del plazo'::text OR h.tipo = 'plazo_fin'::text AND h.titulo ~* 'apertura|inicio del plazo'::text OR h.tipo = 'ejercicio_1'::text AND h.titulo ~* 'convocatoria a examen'::text
UNION ALL
 SELECT h.convocatoria_id,
    h.id AS hito_id,
    'I5_registro_sin_fuente'::text AS invariante,
    format('%s se presenta como oficial pero no cita documento'::text, COALESCE(h.tipo, '(sin tipo)'::text)) AS detalle
   FROM convocatoria_hitos h
  WHERE h.origen = 'registro'::text AND h.source_documento_id IS NULL
UNION ALL
 SELECT h.convocatoria_id,
    h.id AS hito_id,
    'I6_sin_tipo'::text AS invariante,
    format('título sin tipo: %s'::text, h.titulo) AS detalle
   FROM convocatoria_hitos h
  WHERE h.tipo IS NULL OR h.tipo = 'otro'::text
UNION ALL
 SELECT h.convocatoria_id,
    h.id AS hito_id,
    'I7_prevision_caducada'::text AS invariante,
    format('previsión de %s ya pasada y sigue en pie'::text, h.fecha) AS detalle
   FROM convocatoria_hitos h
  WHERE h.origen = 'estimacion'::text AND h.fecha < CURRENT_DATE
UNION ALL
 SELECT h.convocatoria_id,
    h.id AS hito_id,
    'I8_status_contradice_fecha'::text AS invariante,
    format('status=%s con fecha %s'::text, h.status, h.fecha) AS detalle
   FROM convocatoria_hitos h
  WHERE h.status = 'completed'::text AND h.fecha > CURRENT_DATE OR h.status = 'upcoming'::text AND h.fecha < CURRENT_DATE
UNION ALL
 -- I10 (T-124): plazo de inscripción PASADO en una convocatoria aún NO publicada.
 SELECT cv.id AS convocatoria_id,
    NULL::uuid AS hito_id,
    'I10_inscripcion_sin_convocatoria'::text AS invariante,
    format('plazo de inscripción cerrado el %s pero la convocatoria aún no está publicada (estado=%s, plazas_prevision=%s) → la landing dirá "plazo cerrado" en un proceso no convocado'::text,
           cv.inscription_deadline::date, cv.estado_proceso, cv.plazas_prevision) AS detalle
   FROM convocatorias cv
  WHERE cv.inscription_deadline IS NOT NULL
    AND cv.inscription_deadline < CURRENT_DATE
    AND (cv.plazas_prevision = true
      OR EXISTS (SELECT 1 FROM convocatoria_hitos h
                  WHERE h.convocatoria_id = cv.id
                    AND h.tipo = 'convocatoria_publicada'::text
                    AND h.status = 'upcoming'::text));
