-- Sistema proactivo de detección de nuevas convocatorias (OEPs)
-- Arquitectura multi-sensor con scoring de confianza
-- Sensores: llm_semantic (Sensor 1), timeline_silence (Sensor 3), rss (futuro), boe_api (futuro)

CREATE TABLE IF NOT EXISTS oep_detection_signals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  oposicion_id UUID NOT NULL REFERENCES oposiciones(id) ON DELETE CASCADE,

  -- Sensor que generó la señal
  sensor_type TEXT NOT NULL CHECK (sensor_type IN ('llm_semantic', 'timeline_silence', 'rss', 'boe_api', 'google_cse', 'manual')),
  source_url TEXT,

  -- Entidades extraídas (estructuradas)
  detected_year INTEGER,
  detected_plazas_libre INTEGER,
  detected_plazas_discapacidad INTEGER,
  detected_plazas_promocion_interna INTEGER,
  detected_boc_ref TEXT,
  detected_fecha_publicacion DATE,
  detected_fecha_inscripcion_fin DATE,
  detected_fecha_examen DATE,
  detected_estado TEXT,

  -- Clasificación
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  is_novel BOOLEAN NOT NULL DEFAULT FALSE,
  signal_summary TEXT NOT NULL,

  -- Raw data del sensor (LLM response, RSS entry, etc.)
  raw_extraction JSONB DEFAULT '{}',

  -- Workflow admin
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed', 'auto_applied')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_notes TEXT,

  -- Auditoría
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_oep_signals_oposicion ON oep_detection_signals(oposicion_id, created_at DESC);
CREATE INDEX idx_oep_signals_pending ON oep_detection_signals(status, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_oep_signals_novel ON oep_detection_signals(is_novel, status) WHERE is_novel = TRUE;
CREATE INDEX idx_oep_signals_sensor_type ON oep_detection_signals(sensor_type, created_at DESC);

-- Dedupe logical key (seteado por la app en cada insert para evitar duplicados)
-- Formato: "{sensor_type}:{oposicion_id}:{detected_year|0}:{detected_boc_ref|null}"
ALTER TABLE oep_detection_signals ADD COLUMN dedupe_key TEXT;
CREATE UNIQUE INDEX idx_oep_signals_dedupe ON oep_detection_signals (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

COMMENT ON TABLE oep_detection_signals IS 'Señales de detección proactiva de nuevas OEPs/convocatorias. Alimentado por múltiples sensores con confidence scoring.';
COMMENT ON COLUMN oep_detection_signals.sensor_type IS 'Tipo de sensor que generó la señal';
COMMENT ON COLUMN oep_detection_signals.confidence_score IS '0-100. LLM=40, RSS=35, BOE=20, GoogleCSE=15, TimelineSilence=70 (es crítico)';
COMMENT ON COLUMN oep_detection_signals.is_novel IS 'TRUE si detecta OEP/año nuevo no registrado en oposiciones';
COMMENT ON COLUMN oep_detection_signals.status IS 'pending=sin revisar, applied=admin aplicó cambios, dismissed=descartada, auto_applied=score alto + auto';
