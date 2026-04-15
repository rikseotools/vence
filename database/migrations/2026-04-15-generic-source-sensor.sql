-- 2026-04-15: Sensor generic_source para monitorizar fuentes estatales
-- de función pública (DGFP, Sec. Estado FP, Transparencia) que publican
-- instrucciones/acuerdos/circulares no siempre reflejadas en BOE.
--
-- Arquitectura: hash check diario + LLM Haiku solo al detectar cambio real.
-- Las señales se insertan en oep_detection_signals con oposicion_id=NULL
-- porque afectan potencialmente a todas las oposiciones del Estado.

-- 1. Permitir sensor_type='generic_source' en el CHECK constraint
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
    'generic_source'::text
  ]));

-- 2. Tabla para guardar los hashes de las fuentes genéricas
CREATE TABLE IF NOT EXISTS generic_source_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,   -- 'dgfp_legislacion', 'sec_estado_fp', 'transparencia_directrices'
  source_name text NOT NULL,
  source_url text NOT NULL,
  last_hash text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_signal_id uuid REFERENCES oep_detection_signals(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generic_source_checks_active ON generic_source_checks(is_active) WHERE is_active;

-- 3. Seed: las 3 fuentes iniciales (propuestas por el admin)
INSERT INTO generic_source_checks (source_key, source_name, source_url)
VALUES
  ('dgfp_legislacion', 'DGFP Legislación', 'https://digital.gob.es/funcion-publica/dgfp/regimen-juridico/legislacion'),
  ('sec_estado_fp', 'Secretaría de Estado de Función Pública', 'https://digital.gob.es/funcion-publica/secretaria/estado'),
  ('transparencia_directrices', 'Transparencia — Directrices/Instrucciones/Acuerdos/Circulares', 'https://transparencia.gob.es/publicidad-activa/por-materias/normativa-otras-disposiciones/directrices-instrucciones-acuerdos-circulares')
ON CONFLICT (source_key) DO NOTHING;
