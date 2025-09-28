-- Agregar columna 'viewed' a user_medals para trackear si el usuario vio la medalla
ALTER TABLE user_medals ADD COLUMN IF NOT EXISTS viewed BOOLEAN DEFAULT FALSE;

-- Crear índice para consultas rápidas de medallas no vistas
CREATE INDEX IF NOT EXISTS idx_user_medals_viewed ON user_medals(user_id, viewed);

-- Marcar todas las medallas existentes como vistas (para usuarios existentes)
UPDATE user_medals SET viewed = TRUE WHERE viewed IS NULL;

-- Comentario sobre el uso de la columna
COMMENT ON COLUMN user_medals.viewed IS 'Indica si el usuario ha visto esta medalla en la interfaz (para mostrar badge en header)';