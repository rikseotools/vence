-- Añadir columna para cachear Content-Length del BOE
-- Permite detectar cambios con solo HEAD request (~500 bytes vs descargar)

ALTER TABLE laws ADD COLUMN IF NOT EXISTS boe_content_length INTEGER;

COMMENT ON COLUMN laws.boe_content_length IS 'Content-Length del BOE para detectar cambios sin descargar';
