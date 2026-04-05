-- Migración: Añadir deploy_version a tablas de tracking para observabilidad
-- Objetivo: poder trazar qué versión del código tenía el usuario cuando ocurrió un bug
-- Creado: 2026-04-05

-- 1. user_interactions: versión al momento de cada interacción (volumen alto)
ALTER TABLE user_interactions ADD COLUMN IF NOT EXISTS deploy_version TEXT;
CREATE INDEX IF NOT EXISTS user_interactions_deploy_version_idx
  ON user_interactions (deploy_version) WHERE deploy_version IS NOT NULL;

-- 2. tests: versión al momento de crear la sesión de test
ALTER TABLE tests ADD COLUMN IF NOT EXISTS deploy_version TEXT;
CREATE INDEX IF NOT EXISTS tests_deploy_version_idx
  ON tests (deploy_version) WHERE deploy_version IS NOT NULL;

-- 3. Comentarios documentación
COMMENT ON COLUMN user_interactions.deploy_version IS
  'Primeros 8 chars del commit SHA del cliente. Permite correlacionar bugs con versión desplegada.';

COMMENT ON COLUMN tests.deploy_version IS
  'Version del cliente al crear la sesión del test. Clave para investigar bugs de sesiones que no guardan.';
