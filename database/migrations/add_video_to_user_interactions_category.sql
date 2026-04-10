-- =====================================================
-- MIGRACIÓN: Añadir 'video' al constraint de event_category en user_interactions
--
-- PROBLEMA (bug producción 10/04/2026):
--   El componente YouTubePlayer envía eventos de tracking con
--   eventCategory='video' (video_loaded, video_play, video_pause, etc).
--   El schema Zod (lib/api/interactions/schemas.ts) ya incluye 'video' en
--   el enum de eventCategories, por lo que la validación pasa en el
--   handler de /api/interactions. Pero el CHECK constraint de Postgres
--   NO incluía 'video', así que el INSERT fallaba con:
--     new row for relation "user_interactions" violates check constraint
--     "user_interactions_category_check" (code 23514)
--
--   Resultado: 100% de los eventos de vídeo se perdían silenciosamente
--   (el handler logueaba error pero devolvía 200 al cliente).
--
-- SOLUCIÓN:
--   Recrear el constraint incluyendo 'video'. Sincronizar también
--   db/schema.ts (drizzle introspect queda alineado tras esta migración).
--
-- IMPORTANTE — patrón de producción:
--   user_interactions en producción tenía ~3.3M filas / 3 GB. Un
--   ALTER TABLE ADD CONSTRAINT CHECK clásico requeriría un table scan
--   con ACCESS EXCLUSIVE LOCK de ~20s, durante los cuales todas las
--   escrituras a user_interactions quedarían bloqueadas (incluido el
--   tráfico de /api/interactions en vivo).
--
--   Usamos el patrón en dos fases:
--     1. ADD CONSTRAINT ... NOT VALID (lock corto, ~ms, solo metadata).
--     2. VALIDATE CONSTRAINT (usa SHARE UPDATE EXCLUSIVE LOCK que NO
--        bloquea lecturas ni escrituras, escanea la tabla en segundo plano).
--
--   Para tablas pequeñas (<100k filas) el patrón simple también funciona.
--   Se deja este patrón como referencia para cualquier replay futuro.
--
-- Lista completa tras esta migración (debe mantenerse en sync con
-- lib/api/interactions/schemas.ts `eventCategories`):
--   test, chat, navigation, ui, auth, error, conversion, psychometric, video
--
-- Aplicada en producción: 2026-04-10
--   - Fase 1 (DROP + ADD NOT VALID): 194 ms
--   - Fase 2 (VALIDATE): 20.3 s sin bloquear tráfico
-- =====================================================

-- Guardias defensivas opcionales — copiar antes de ejecutar en producción
-- SET lock_timeout = '5s';
-- SET statement_timeout = '60s';

-- ============================================
-- Fase 1: añadir el constraint como NOT VALID
-- Lock: ACCESS EXCLUSIVE breve (solo metadata), ms
-- ============================================
BEGIN;

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
  ))
  NOT VALID;

COMMIT;

-- ============================================
-- Fase 2: validar el constraint existente
-- Lock: SHARE UPDATE EXCLUSIVE (no bloquea lecturas ni escrituras, solo
-- otras operaciones DDL). Escanea la tabla, tarda proporcionalmente a N.
-- Como el nuevo constraint es superconjunto del anterior, todas las filas
-- existentes son trivialmente válidas — nunca falla por datos preexistentes.
-- ============================================

-- Si la tabla es grande, subir el statement_timeout antes:
-- SET statement_timeout = '300s';

ALTER TABLE user_interactions
  VALIDATE CONSTRAINT user_interactions_category_check;

-- ============================================
-- Fase 3: documentación
-- ============================================
COMMENT ON COLUMN user_interactions.event_category IS
  'Categoría del evento (test, chat, navigation, ui, auth, error, conversion, psychometric, video)';

-- ============================================
-- Verificación
-- ============================================
DO $$
DECLARE
  constraint_def text;
  is_validated boolean;
BEGIN
  SELECT pg_get_constraintdef(c.oid), c.convalidated
    INTO constraint_def, is_validated
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

  IF NOT is_validated THEN
    RAISE EXCEPTION '❌ El constraint existe pero no está validado (convalidated=false). Ejecuta VALIDATE CONSTRAINT.';
  END IF;

  RAISE NOTICE '✅ Constraint user_interactions_category_check actualizado y validado correctamente';
  RAISE NOTICE '   Definición: %', constraint_def;
END $$;
