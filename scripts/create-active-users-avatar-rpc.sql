-- Función RPC para obtener usuarios activos con avatar en modo automático
-- Solo devuelve usuarios que tuvieron actividad en la última semana
-- Esto es MUCHO más eficiente que obtener todos y filtrar después

CREATE OR REPLACE FUNCTION get_active_users_with_automatic_avatar(
  p_days_back INTEGER DEFAULT 7
)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT uas.user_id
  FROM user_avatar_settings uas
  WHERE uas.mode = 'automatic'
    AND EXISTS (
      SELECT 1
      FROM tests t
      INNER JOIN test_questions tq ON tq.test_id = t.id
      WHERE t.user_id = uas.user_id
        AND tq.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
    );
$$;

COMMENT ON FUNCTION get_active_users_with_automatic_avatar IS
'Obtiene usuarios con avatar automático que tuvieron actividad en los últimos N días.
Usado por el cron de rotación semanal para procesar solo usuarios activos.
Con 100k usuarios, solo procesa los ~5k activos en vez de todos.';
