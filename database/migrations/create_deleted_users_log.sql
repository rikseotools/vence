-- Migración: Crear tabla deleted_users_log
-- Descripción: Registro de usuarios que solicitan eliminación de cuenta (GDPR)
-- Fecha: 2026-02-04

CREATE TABLE IF NOT EXISTS deleted_users_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  email text NOT NULL,
  full_name text,
  plan_type text,
  target_oposicion text,
  registered_at timestamptz,
  deleted_at timestamptz DEFAULT now(),
  days_active int,
  total_tests int DEFAULT 0,
  total_payments numeric DEFAULT 0,
  deletion_reason text,
  requested_via text DEFAULT 'feedback',
  created_at timestamptz DEFAULT now()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_deleted_users_email ON deleted_users_log(email);
CREATE INDEX IF NOT EXISTS idx_deleted_users_deleted_at ON deleted_users_log(deleted_at);

-- Comentario descriptivo
COMMENT ON TABLE deleted_users_log IS 'Registro de usuarios que solicitaron eliminación de cuenta (GDPR)';
