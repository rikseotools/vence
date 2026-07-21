-- 20260721_convocatoria_i2_titulo_aware.sql
--
-- Afina I2_duplicado de convocatoria_hito_incidencias para que NO produzca falsos
-- positivos con repeticiones LEGÍTIMAS del mismo `tipo` dentro de una convocatoria:
--   • 2ª lista provisional, ampliación de plazo, fin inscripción vs fin subsanación,
--     y (transitorio) dos campañas bajo un mismo convocatoria_id (multi-convocatoria).
--
-- Antes: agrupaba solo por (convocatoria_id, tipo) → CUALQUIER `tipo` repetido con
-- fechas distintas saltaba como "duplicado". 86% de falsos positivos en el sweep
-- (6 de 7 fires eran hitos DISTINTOS que comparten tipo), lo que genera fatiga de
-- alerta y ahoga los errores reales (p.ej. inversión de 1 día en celador-sermas).
--
-- Ahora: agrupa también por TÍTULO normalizado. Dos títulos distintos (Cierre
-- inscripción vs Cierre ampliación) caen en grupos distintos → no saltan. Un
-- duplicado REAL (mismo hito, mismo título, dos fechas → una miente) tiene el mismo
-- título → SIGUE saltando. Precisión arriba, recall intacto (no se pierde robustez:
-- lo que I2 debe cazar tiene título idéntico; ver __tests__ y verificación inline).
--
-- Solo se toca el bloque I2. I1/I5/I6/I7/I8 quedan idénticos.

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
 --      Agrupar por título evita el falso positivo con repeticiones legítimas del mismo tipo.
 SELECT h.convocatoria_id,
    (array_agg(h.id ORDER BY h.fecha))[1] AS hito_id,
    'I2_duplicado'::text AS invariante,
    format('%s "%s" aparece %s veces con fechas distintas'::text, h.tipo, min(h.titulo), count(*)) AS detalle
   FROM convocatoria_hitos h
  WHERE h.tipo = ANY (ARRAY['ejercicio_1'::text, 'plazo_inicio'::text, 'plazo_fin'::text])
  GROUP BY h.convocatoria_id, h.tipo, lower(regexp_replace(COALESCE(h.titulo, ''::text), '\s+'::text, ' '::text, 'g'::text))
 HAVING count(DISTINCT h.fecha) > 1
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
  'Invariantes deterministas del timeline (sin IA, sin documento). I2 título-aware: repeticiones legítimas del mismo tipo (2ª lista, ampliación, subsanación) no saltan; duplicado real (mismo título, dos fechas) sí.';
