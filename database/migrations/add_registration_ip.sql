-- Añadir campo registration_ip a user_profiles
-- Para detectar posibles multicuentas

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(45);

-- Índice para búsquedas por IP
CREATE INDEX IF NOT EXISTS idx_user_profiles_registration_ip
ON user_profiles(registration_ip);

-- Comentario
COMMENT ON COLUMN user_profiles.registration_ip IS 'IP del usuario al momento del registro, para detectar multicuentas';
