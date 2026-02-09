-- database/migrations/add_law_slugs.sql
-- Fase 1: Añadir columna slug a tabla laws para eliminar diccionarios manuales
--
-- Esta migración añade una columna `slug` que almacena el identificador URL-friendly
-- de cada ley, eliminando la necesidad de mantener diccionarios sincronizados manualmente.
--
-- Ejecutar con: psql $DATABASE_URL -f database/migrations/add_law_slugs.sql

BEGIN;

-- 1. Añadir columna slug (nullable inicialmente para poder poblarla)
ALTER TABLE laws
ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Crear índice único para búsquedas rápidas y evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_laws_slug
ON laws(slug)
WHERE slug IS NOT NULL;

-- 3. Añadir comentario explicativo
COMMENT ON COLUMN laws.slug IS 'URL-friendly identifier (ej: orden-apu-1461-2002). Fuente única de verdad para mapeo slug↔short_name';

COMMIT;

-- Verificar
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'laws' AND column_name = 'slug';
