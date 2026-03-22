-- Tabla para monitorear cambios en las páginas de seguimiento de convocatorias
-- El cron diario compara el hash del contenido para detectar actualizaciones

CREATE TABLE IF NOT EXISTS convocatoria_seguimiento_checks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  oposicion_id UUID NOT NULL REFERENCES oposiciones(id) ON DELETE CASCADE,
  checked_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  content_hash TEXT NOT NULL,
  content_length INTEGER,
  http_status INTEGER,
  has_changed BOOLEAN DEFAULT FALSE NOT NULL,
  change_reviewed BOOLEAN DEFAULT FALSE NOT NULL,
  reviewed_at TIMESTAMPTZ,
  error_message TEXT,
  -- Snapshot del texto relevante (primeros 2000 chars sin HTML)
  content_preview TEXT
);

CREATE INDEX idx_seguimiento_checks_oposicion ON convocatoria_seguimiento_checks(oposicion_id, checked_at DESC);
CREATE INDEX idx_seguimiento_checks_unreviewed ON convocatoria_seguimiento_checks(has_changed, change_reviewed) WHERE has_changed = TRUE AND change_reviewed = FALSE;

-- Columnas en oposiciones para cache del último check
ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS seguimiento_last_checked TIMESTAMPTZ;
ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS seguimiento_last_hash TEXT;
ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS seguimiento_change_detected_at TIMESTAMPTZ;
ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS seguimiento_change_status TEXT DEFAULT 'ok' CHECK (seguimiento_change_status IN ('ok', 'changed', 'error'));

COMMENT ON TABLE convocatoria_seguimiento_checks IS 'Historial de checks de las páginas de seguimiento de convocatorias';
COMMENT ON COLUMN oposiciones.seguimiento_change_status IS 'ok = sin cambios, changed = cambio pendiente de revisión, error = fallo al verificar';
