-- Sensor `nota_examen`: superficie de las fechas de examen que el cron
-- `detect-notas-convocatoria` YA extrae de las páginas de seguimiento.
--
-- Contexto (21/07/2026): el detector de notas baja los PDFs de cada
-- `seguimiento_url`, y su extracción LLM rellena `convocatoria_notas.llm_extraction.fecha_examen`.
-- Pero esa tabla NO la lee nadie (0 triadas de 1.862 notas; 58 oposiciones con
-- fecha de examen ya extraída que ningún admin había visto). El sensor retirado
-- `hash_change` (whole-page SHA-256, 4% de acierto) dejó un hueco: no hay ningún
-- camino automático que convierta "una convocatoria trackeada publicó su fecha de
-- examen" en una alerta accionable. `nota_examen` cierra ese hueco reusando el
-- detector vivo: emite una señal OEP (bandeja `/admin/oep-signals`) para que un
-- humano la verifique y aplique (nunca auto-apply — el detector es ruidoso:
-- mis-atribuye procesos hermanos de la misma página y extrae fechas de docs viejos).
--
-- Roadmap/diseño: docs/runbooks/observability.md + backlog T-035/T-047/T-050.

BEGIN;

-- Ampliar la taxonomía cerrada de sensor_type con 'nota_examen'.
-- (misma mecánica que 20260708_temario_change_sensor, que añadió 'temario_change')
ALTER TABLE public.oep_detection_signals
  DROP CONSTRAINT IF EXISTS oep_detection_signals_sensor_type_check;
ALTER TABLE public.oep_detection_signals
  ADD CONSTRAINT oep_detection_signals_sensor_type_check
  CHECK (sensor_type = ANY (ARRAY[
    'llm_semantic','timeline_silence','hash_change','regional_scan','rss',
    'boe_api','google_cse','manual','generic_source','pag_empleo','competitor',
    'temario_change','nota_examen'
  ]));

COMMIT;
