-- Tabla para registrar cuando un usuario ve el modal de bloqueo por sesiones múltiples
-- Esto permite trackear si los usuarios reinciden después del aviso

CREATE TABLE IF NOT EXISTS session_block_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_session_block_events_user_id ON session_block_events(user_id);
CREATE INDEX IF NOT EXISTS idx_session_block_events_blocked_at ON session_block_events(blocked_at DESC);

-- Comentario
COMMENT ON TABLE session_block_events IS 'Registra cada vez que un usuario ve el modal de bloqueo por sesiones simultáneas';
