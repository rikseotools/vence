-- Capa 1 del sistema de detección: fuentes regionales (entidades)
-- Vigila páginas "convocatorias en curso" de cada CCAA, ayuntamiento, estado para
-- descubrir OEPs NUEVAS que aún no están en la tabla oposiciones.

CREATE TABLE IF NOT EXISTS detection_sources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('estado', 'ccaa', 'ayuntamiento', 'diputacion')),
  region_name TEXT NOT NULL,
  boletin_name TEXT,
  listing_url TEXT NOT NULL,
  search_keywords TEXT[] DEFAULT ARRAY['auxiliar administrativo', 'administrativo', 'oposicion', 'convocatoria', 'C1', 'C2'],
  position_groups TEXT[] DEFAULT ARRAY['C1', 'C2'],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  last_checked TIMESTAMPTZ,
  last_hash TEXT,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_detection_sources_type ON detection_sources(source_type, is_active);
CREATE INDEX idx_detection_sources_region ON detection_sources(region_name);
CREATE UNIQUE INDEX idx_detection_sources_url_unique ON detection_sources(listing_url);

COMMENT ON TABLE detection_sources IS 'Capa 1: fuentes regionales (entidades) para descubrir OEPs nuevas C1/C2';
COMMENT ON COLUMN detection_sources.listing_url IS 'Página genérica de "convocatorias en curso" de la entidad';
COMMENT ON COLUMN detection_sources.position_groups IS 'Grupos a filtrar: C1, C2, A1, A2, etc.';

-- Modificar oep_detection_signals para soportar señales "regionales" (sin oposición asociada)
ALTER TABLE oep_detection_signals ALTER COLUMN oposicion_id DROP NOT NULL;
ALTER TABLE oep_detection_signals ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES detection_sources(id) ON DELETE SET NULL;
ALTER TABLE oep_detection_signals ADD COLUMN IF NOT EXISTS region_name TEXT;
ALTER TABLE oep_detection_signals ADD COLUMN IF NOT EXISTS position_category TEXT;
ALTER TABLE oep_detection_signals ADD COLUMN IF NOT EXISTS detected_oposicion_name TEXT;

CREATE INDEX IF NOT EXISTS idx_oep_signals_source ON oep_detection_signals(source_id, created_at DESC) WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oep_signals_novel_regional ON oep_detection_signals(region_name, status) WHERE oposicion_id IS NULL AND status = 'pending';

-- Ampliar enum sensor_type para 'regional_scan'
ALTER TABLE oep_detection_signals DROP CONSTRAINT IF EXISTS oep_detection_signals_sensor_type_check;
ALTER TABLE oep_detection_signals ADD CONSTRAINT oep_detection_signals_sensor_type_check
  CHECK (sensor_type IN ('llm_semantic', 'timeline_silence', 'hash_change', 'regional_scan', 'rss', 'boe_api', 'google_cse', 'manual'));

COMMENT ON COLUMN oep_detection_signals.oposicion_id IS 'NULL cuando es detección regional de OEP nueva no en BD';
COMMENT ON COLUMN oep_detection_signals.source_id IS 'FK a detection_sources si la señal viene de escaneo regional';
COMMENT ON COLUMN oep_detection_signals.detected_oposicion_name IS 'Nombre del proceso selectivo extraído por LLM (cuando oposicion_id es NULL)';
