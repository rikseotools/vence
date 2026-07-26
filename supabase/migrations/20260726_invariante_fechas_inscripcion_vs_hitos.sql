-- supabase/migrations/20260726_invariante_fechas_inscripcion_vs_hitos.sql
--
-- I11: las fechas de inscripción de `convocatorias` contra las de sus propios hitos.
--
-- ## El punto ciego que cierra
--
-- La landing pinta el plazo DOS VECES desde sitios distintos: la caja de la convocatoria lee las
-- columnas `inscription_start`/`inscription_deadline` y el timeline lee los hitos `plazo_inicio`
-- y `plazo_fin`. Ninguno de los 8 invariantes anteriores los comparaba entre sí, así que podían
-- separarse en silencio y la misma página acababa dando dos fechas del mismo plazo. Es la misma
-- familia del incidente de `administrativo-madrid` (26/07), donde el timeline mezclaba dos ciclos.
--
-- ## Por qué este predicado
--
-- No necesita conocimiento externo: es una contradicción de la fila CONSIGO MISMA, igual que I10.
-- Medido antes de añadirlo, sobre las 123 landings activas: **2 casos**, los dos con el hito
-- `plazo_inicio` cargando la fecha de CIERRE y sin hito `plazo_fin`. Precisión alta y volumen
-- manejable — que es la condición para que un invariante entre al sweep en vez de a una bandeja.
--
-- Aditivo: solo añade una rama al UNION ALL; el resto de la vista queda igual.

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
 SELECT cv.id AS convocatoria_id,
    NULL::uuid AS hito_id,
    'I10_inscripcion_sin_convocatoria'::text AS invariante,
    format('plazo de inscripción cerrado el %s pero la convocatoria aún no está publicada (estado=%s, plazas_prevision=%s) → la landing dirá "plazo cerrado" en un proceso no convocado'::text, cv.inscription_deadline, cv.estado_proceso, cv.plazas_prevision) AS detalle
   FROM convocatorias cv
  WHERE cv.inscription_deadline IS NOT NULL AND cv.inscription_deadline < CURRENT_DATE AND (cv.plazas_prevision = true OR (EXISTS ( SELECT 1
           FROM convocatoria_hitos h
          WHERE h.convocatoria_id = cv.id AND h.tipo = 'convocatoria_publicada'::text AND h.status = 'upcoming'::text)))
UNION ALL
-- I11 (T-142, 26/07/2026): las FECHAS de inscripción de la fila `convocatorias` y las de sus
-- propios hitos `plazo_inicio`/`plazo_fin` deben coincidir. La landing pinta las dos cosas —la
-- caja de la convocatoria sale de las columnas y el timeline de los hitos— así que cuando
-- divergen la misma página dice dos fechas distintas del mismo plazo. Medido al añadirlo: 2 de
-- 123 landings activas, las dos con el hito `plazo_inicio` cargando la fecha de CIERRE y sin
-- `plazo_fin`. Es contradicción de la fila consigo misma: no necesita fuente externa.
 SELECT cv.id AS convocatoria_id,
    h.id AS hito_id,
    'I11_fechas_inscripcion_vs_hitos'::text AS invariante,
    format('la convocatoria dice %s=%s y su hito %s marca %s → la landing muestra dos fechas distintas del mismo plazo'::text,
           CASE WHEN h.tipo = 'plazo_inicio'::text THEN 'inscription_start' ELSE 'inscription_deadline' END,
           CASE WHEN h.tipo = 'plazo_inicio'::text THEN cv.inscription_start ELSE cv.inscription_deadline END,
           h.tipo, h.fecha) AS detalle
   FROM convocatorias cv
     JOIN convocatoria_hitos h ON h.convocatoria_id = cv.id
  WHERE cv.archived_at IS NULL
    AND ((h.tipo = 'plazo_inicio'::text AND cv.inscription_start IS NOT NULL AND h.fecha <> cv.inscription_start)
      OR (h.tipo = 'plazo_fin'::text AND cv.inscription_deadline IS NOT NULL AND h.fecha <> cv.inscription_deadline));
