-- 2026-06-25: Sensor pag_empleo — descubrimiento nacional de convocatorias C1/C2
-- de plazo abierto vía el Buscador del Punto de Acceso General (administracion.gob.es).
--
-- Por qué: detect-boletines solo lee BOCYL + BOE (2 de ~19 boletines), así que
-- toda convocatoria autonómica no-CyL y TODAS las locales quedaban ciegas. El PAG
-- es un agregador oficial que reúne Estado + autonómico + LOCAL con filtro nativo
-- de grupo (C1/C2) y de plazo abierto. Las señales se insertan en
-- oep_detection_signals (oposicion_id casado con el catálogo cuando hay match, o
-- NULL = descubrimiento) y aparecen en el badge 🎯 OEPs / panel /admin/oep-signals.
--
-- Único cambio de esquema: ampliar el CHECK de sensor_type para admitir 'pag_empleo'.
-- (Espejo de 2026-04-15-generic-source-sensor.sql.)

ALTER TABLE oep_detection_signals
  DROP CONSTRAINT IF EXISTS oep_detection_signals_sensor_type_check;

ALTER TABLE oep_detection_signals
  ADD CONSTRAINT oep_detection_signals_sensor_type_check
  CHECK (sensor_type = ANY (ARRAY[
    'llm_semantic'::text,
    'timeline_silence'::text,
    'hash_change'::text,
    'regional_scan'::text,
    'rss'::text,
    'boe_api'::text,
    'google_cse'::text,
    'manual'::text,
    'generic_source'::text,
    'pag_empleo'::text
  ]));
