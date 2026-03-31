-- Migración: Añadir content_data e image_url a la tabla questions
-- Fecha: 31/03/2026
-- Motivo: Las preguntas de informática (Word, Excel) necesitan mostrar imágenes
-- y datos visuales (tablas, capturas de pantalla) igual que psychometric_questions.
-- Esto permite que las preguntas legislativas de ofimática tengan contenido visual
-- sin necesidad de migrarlas a psychometric_questions.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS content_data JSONB DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Comentarios
COMMENT ON COLUMN questions.content_data IS 'Datos visuales estructurados (tablas, instrucciones, etc.) en formato JSON. Mismo formato que psychometric_questions.content_data';
COMMENT ON COLUMN questions.image_url IS 'URL de imagen asociada a la pregunta (Supabase Storage). Para capturas de pantalla, anexos visuales, etc.';
