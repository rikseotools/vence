-- =====================================================
-- MIGRACIÓN: Añadir 'video' al constraint de event_category en user_interactions
--
-- PROBLEMA (bug producción 10/04/2026):
--   El componente YouTubePlayer envía eventos de tracking con
--   eventCategory='video' (video_loaded, video_play, video_pause, etc).
--   El schema Zod (lib/api/interactions/schemas.ts) ya incluye 'video' en
--   el enum de eventCategories, por lo que la validación pasa en el
--   handler de /api/interactions. Pero el CHECK constraint de Postgres
--   NO incluye 'video', así que el INSERT falla con:
--     new row for relation "user_interactions" violates check constraint
--     "user_interactions_category_check" (code 23514)
--
--   Resultado: 100% de los eventos de vídeo se pierden silenciosamente
--   (el handler loguea error pero devuelve 200 al cliente).
--
-- SOLUCIÓN:
--   Recrear el constraint incluyendo 'video'. Idempotente: primero DROP IF
--   EXISTS, luego ADD. Sincronizar también db/schema.ts (drizzle introspect
--   queda alineado tras esta migración).
--
-- Lista completa tras esta migración (debe mantenerse en sync con
-- lib/api/interactions/schemas.ts `eventCategories`):
--   test, chat, navigation, ui, auth, error, conversion, psychometric, video
-- =====================================================

ALTER TABLE user_interactions
  DROP CONSTRAINT IF EXISTS user_interactions_category_check;

ALTER TABLE user_interactions
  ADD CONSTRAINT user_interactions_category_check
  CHECK (event_category IN (
    'test',
    'chat',
    'navigation',
    'ui',
    'auth',
    'error',
    'conversion',
    'psychometric',
    'video'
  ));

-- Actualizar el comentario para documentar la lista actualizada
COMMENT ON COLUMN user_interactions.event_category IS
  'Categoría del evento (test, chat, navigation, ui, auth, error, conversion, psychometric, video)';

-- =====================================================
-- Verificación
-- =====================================================
DO $$
DECLARE
  constraint_def text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
    INTO constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'user_interactions'
     AND c.conname = 'user_interactions_category_check';

  IF constraint_def IS NULL THEN
    RAISE EXCEPTION '❌ El constraint user_interactions_category_check no existe tras la migración';
  END IF;

  IF constraint_def NOT LIKE '%video%' THEN
    RAISE EXCEPTION '❌ El constraint no incluye ''video'' tras la migración. Definición: %', constraint_def;
  END IF;

  RAISE NOTICE '✅ Constraint user_interactions_category_check actualizado correctamente';
  RAISE NOTICE '   Definición: %', constraint_def;
END $$;
