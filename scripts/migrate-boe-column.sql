-- Migración: Añadir columna last_update_boe a tabla laws
-- Ejecutar en SQL Editor de Supabase

-- 1. Añadir la columna
ALTER TABLE laws ADD COLUMN IF NOT EXISTS last_update_boe TEXT;

-- 2. Verificar la estructura
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'laws' 
  AND column_name = 'last_update_boe';

-- 3. Mostrar datos actuales para verificar
SELECT id, short_name, last_update_boe, last_checked 
FROM laws 
WHERE boe_url IS NOT NULL 
ORDER BY short_name;