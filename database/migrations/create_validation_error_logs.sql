-- Tabla para persistir errores de validación de respuestas en las APIs
-- Permite investigar problemas como el de Beatriz (UI congelada) sin depender de Vercel logs
-- Los inserts son fire-and-forget (async, no bloquean al usuario)

CREATE TABLE IF NOT EXISTS validation_error_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Contexto del error
  endpoint text NOT NULL,           -- '/api/answer', '/api/exam/validate', '/api/answer/psychometric'
  error_type text NOT NULL,         -- 'timeout', 'network', 'db_connection', 'validation', 'unknown'
  error_message text NOT NULL,
  error_stack text,                 -- Stack trace (solo en server)

  -- Contexto del usuario
  user_id uuid,                     -- Puede ser null si el error ocurre antes de autenticar
  question_id text,                 -- ID de la pregunta que se intentaba validar
  test_id text,                     -- ID del test/sesión

  -- Contexto del request
  request_body jsonb DEFAULT '{}',  -- Body del request (sin datos sensibles)

  -- Contexto del deploy
  deploy_version text,              -- VERCEL_GIT_COMMIT_SHA o 'local'
  vercel_region text,               -- Región de Vercel que procesó el request

  -- Metadata
  http_status integer,              -- Status code devuelto
  duration_ms integer,              -- Tiempo que tardó la request antes del error
  user_agent text,

  created_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para consultas frecuentes
CREATE INDEX idx_vel_created_at ON validation_error_logs (created_at DESC);
CREATE INDEX idx_vel_endpoint ON validation_error_logs (endpoint);
CREATE INDEX idx_vel_error_type ON validation_error_logs (error_type);
CREATE INDEX idx_vel_user_id ON validation_error_logs (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_vel_deploy_version ON validation_error_logs (deploy_version) WHERE deploy_version IS NOT NULL;

-- Composite para "errores de este usuario en las últimas 24h"
CREATE INDEX idx_vel_user_recent ON validation_error_logs (user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- RLS: solo service_role puede escribir (las APIs usan getDb con service role)
ALTER TABLE validation_error_logs ENABLE ROW LEVEL SECURITY;

-- Policy: service_role puede todo
CREATE POLICY "service_role_all" ON validation_error_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: usuarios autenticados solo pueden leer sus propios errores (por si se necesita en el futuro)
CREATE POLICY "users_read_own" ON validation_error_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE validation_error_logs IS 'Errores de las APIs de validación de respuestas (/api/answer, /api/exam/validate, /api/answer/psychometric). Inserts fire-and-forget.';
