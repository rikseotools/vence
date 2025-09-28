-- Script para verificar si las tablas de notificaciones push existen
-- Ejecutar en Supabase SQL Editor

-- 1. Verificar que las tablas existen
SELECT 
  schemaname,
  tablename,
  tableowner
FROM pg_tables 
WHERE tablename IN (
  'user_notification_settings',
  'user_activity_patterns', 
  'notification_templates',
  'notification_logs',
  'notification_metrics',
  'user_smart_scheduling'
)
ORDER BY tablename;

-- 2. Verificar estructura de la tabla principal
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_notification_settings'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar constraints únicos (esto es lo que falla)
SELECT 
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name IN ('user_notification_settings', 'user_smart_scheduling')
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.table_name, tc.constraint_name;

-- 4. Verificar índices
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'user_notification_settings',
  'user_smart_scheduling'
)
ORDER BY tablename, indexname;