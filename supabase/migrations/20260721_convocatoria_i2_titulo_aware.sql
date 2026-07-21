-- 20260721_convocatoria_i2_titulo_aware.sql
--
-- Refina la detección de contradicciones de timeline en convocatoria_hito_incidencias,
-- separando DOS clases de bug que antes I2_duplicado mezclaba (y hacía mal):
--
--   1) DUPLICADO REAL (I2_duplicado, título-aware): el MISMO hito (mismo tipo Y mismo
--      título normalizado) con dos fechas distintas = una miente. Agrupar por título
--      evita el FALSO POSITIVO con repeticiones LEGÍTIMAS del mismo tipo pero hito
--      distinto: 2ª lista provisional, ampliación de plazo, fin inscripción vs fin
--      subsanación, y (transitorio) dos campañas bajo un mismo convocatoria_id
--      (multi-convocatoria). Verificado en prod (21/07): la versión anterior
--      —agrupar solo por (convocatoria_id, tipo)— disparaba 11, de las que 7 eran
--      falsos positivos legítimos.
--
--   2) MISTYPE (I9_tipo_incoherente, NUEVO): el título CONTRADICE el tipo. No es un
--      duplicado (los títulos difieren) → I2 título-aware NO lo ve, y forzar a I2 a
--      cazarlo reintroduciría los falsos positivos. Detector DEDICADO, alta precisión:
--      un 'cierre' etiquetado plazo_inicio, una 'apertura' etiquetada plazo_fin, o una
--      'convocatoria a examen' (anuncio) etiquetada ejercicio_1. Verificado 2/2 real,
--      0 FP en prod (21/07) — son justo los 2 errores que la revisión adversarial
--      demostró que I2 título-aware dejaba de cazar. Así el recall de la clase mistype
--      queda cubierto por I9, no perdido: cada detector hace UN trabajo.
--
-- I9 es GRAVE (mismo peso que I1/I2 en el sweep: un tipo mal contradice el timeline).
-- I1/I5/I6/I7/I8 quedan idénticos.

CREATE OR REPLACE VIEW public.convocatoria_hito_incidencias AS
 SELECT h1.convocatoria_id,
    h1.id AS hito_id,
    'I1_orden'::text AS invariante,
    format('%s (%s) es posterior a %s (%s)'::text, h1.tipo, h1.fecha, h2.tipo, h2.fecha) AS detalle
   FROM convocatoria_hitos h1
     JOIN convocatoria_hitos h2 ON h2.convocatoria_id = h1.convocatoria_id AND h1.fecha > h2.fecha
  WHERE h1.tipo = 'plazo_inicio'::text AND h2.tipo = 'plazo_fin'::text OR h1.tipo = 'plazo_fin'::text AND h2.tipo = 'ejercicio_1'::text OR h1.tipo = 'ejercicio_1'::text AND h2.tipo = 'resultados'::text
UNION ALL
 -- I2 · MISMO hito (mismo tipo Y mismo título normalizado) con dos fechas = una miente.
 SELECT h.convocatoria_id,
    (array_agg(h.id ORDER BY h.fecha))[1] AS hito_id,
    'I2_duplicado'::text AS invariante,
    format('%s "%s" aparece %s veces con fechas distintas'::text, h.tipo, min(h.titulo), count(*)) AS detalle
   FROM convocatoria_hitos h
  WHERE h.tipo = ANY (ARRAY['ejercicio_1'::text, 'plazo_inicio'::text, 'plazo_fin'::text])
  GROUP BY h.convocatoria_id, h.tipo, lower(regexp_replace(COALESCE(h.titulo, ''::text), '\s+'::text, ' '::text, 'g'::text))
 HAVING count(DISTINCT h.fecha) > 1
UNION ALL
 -- I9 · MISTYPE: el título contradice el tipo (recall de la clase que I2 título-aware no cubre).
 SELECT h.convocatoria_id,
    h.id AS hito_id,
    'I9_tipo_incoherente'::text AS invariante,
    format('tipo=%s contradice el título "%s"'::text, h.tipo, h.titulo) AS detalle
   FROM convocatoria_hitos h
  WHERE (h.tipo = 'plazo_inicio'::text AND h.titulo ~* 'cierre|clausura|fin del plazo'::text)
     OR (h.tipo = 'plazo_fin'::text    AND h.titulo ~* 'apertura|inicio del plazo'::text)
     OR (h.tipo = 'ejercicio_1'::text  AND h.titulo ~* 'convocatoria a examen'::text)
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
  WHERE h.status = 'completed'::text AND h.fecha > CURRENT_DATE OR h.status = 'upcoming'::text AND h.fecha < CURRENT_DATE;

COMMENT ON VIEW public.convocatoria_hito_incidencias IS
  'Invariantes deterministas del timeline (sin IA). I2 título-aware (repeticiones legítimas del mismo tipo no saltan; duplicado real con mismo título sí). I9: mistype (título contradice el tipo), la clase que I2 título-aware no cubre. I1/I2/I9 = graves.';
