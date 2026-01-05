-- Añadir columnas para cachear headers HTTP del BOE
-- Esto permite optimizar la detección de cambios sin descargar todo el contenido

ALTER TABLE laws
ADD COLUMN IF NOT EXISTS http_etag TEXT,
ADD COLUMN IF NOT EXISTS http_last_modified TEXT;

-- Comentarios
COMMENT ON COLUMN laws.http_etag IS 'ETag header del BOE para cache HTTP';
COMMENT ON COLUMN laws.http_last_modified IS 'Last-Modified header del BOE para cache HTTP';
