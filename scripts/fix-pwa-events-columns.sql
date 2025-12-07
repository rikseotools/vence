-- Script para agregar las columnas faltantes a la tabla pwa_events
-- Estas columnas son necesarias para el tracking de PWA

-- Agregar columna displayMode si no existe
ALTER TABLE pwa_events
ADD COLUMN IF NOT EXISTS "displayMode" text;

-- Agregar columna detectionMethod si no existe
ALTER TABLE pwa_events
ADD COLUMN IF NOT EXISTS "detectionMethod" text;

-- Comentarios descriptivos
COMMENT ON COLUMN pwa_events."displayMode" IS 'Modo de visualización de la PWA (standalone, browser, fullscreen)';
COMMENT ON COLUMN pwa_events."detectionMethod" IS 'Método usado para detectar si es PWA (display-mode, user-agent, etc)';

-- Verificar que las columnas se agregaron correctamente
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pwa_events'
AND column_name IN ('displayMode', 'detectionMethod');