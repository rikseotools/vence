-- Script para corregir los errores de base de datos
-- Ejecutar en Supabase SQL Editor

-- ========================================
-- 1. FIX: Tabla pwa_events - Agregar columnas faltantes
-- ========================================

-- Verificar si la tabla existe
DO $$
BEGIN
    -- Agregar columna displayMode si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pwa_events'
        AND column_name = 'displayMode'
    ) THEN
        ALTER TABLE pwa_events
        ADD COLUMN displayMode TEXT DEFAULT 'browser';

        RAISE NOTICE 'Columna displayMode agregada';
    END IF;

    -- Agregar columna confidence si no existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'pwa_events'
        AND column_name = 'confidence'
    ) THEN
        ALTER TABLE pwa_events
        ADD COLUMN confidence TEXT DEFAULT 'low';

        RAISE NOTICE 'Columna confidence agregada';
    END IF;
END $$;

-- ========================================
-- 2. FIX: RLS para user_streaks
-- ========================================

-- Habilitar RLS si no está habilitado
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Users can view own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Users can update own streaks" ON user_streaks;
DROP POLICY IF EXISTS "Users can insert own streaks" ON user_streaks;

-- Crear políticas nuevas
CREATE POLICY "Users can view own streaks"
ON user_streaks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own streaks"
ON user_streaks FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own streaks"
ON user_streaks FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ========================================
-- 3. FIX: RLS para tests
-- ========================================

-- Habilitar RLS si no está habilitado
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Users can view own tests" ON tests;
DROP POLICY IF EXISTS "Users can update own tests" ON tests;
DROP POLICY IF EXISTS "Users can insert own tests" ON tests;

-- Crear políticas nuevas
CREATE POLICY "Users can view own tests"
ON tests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tests"
ON tests FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tests"
ON tests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- ========================================
-- 4. VERIFICACIÓN: Comprobar que todo está bien
-- ========================================

-- Verificar columnas de pwa_events
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'pwa_events'
AND column_name IN ('displayMode', 'confidence')
ORDER BY ordinal_position;

-- Verificar políticas RLS
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('user_streaks', 'tests')
ORDER BY tablename, policyname;

-- ========================================
-- 5. BONUS: Crear user_streaks si no existe
-- ========================================

CREATE TABLE IF NOT EXISTS user_streaks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    streak_start_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Crear índice para mejor performance
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);

-- ========================================
-- MENSAJE FINAL
-- ========================================
-- Ejecuta este script en el SQL Editor de Supabase
-- Después de ejecutarlo:
-- 1. Recarga la página de tu aplicación
-- 2. Los errores 406 y 400 deberían desaparecer
-- 3. Si persisten, revisa que el usuario esté autenticado correctamente