-- Ver estado actual de RLS y políticas - VERSIÓN CORREGIDA
-- =====================================================

-- 1. Ver si RLS está habilitado en la tabla (sin forcerowsecurity)
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_question_history';

-- 2. Ver todas las políticas actuales de la tabla
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'user_question_history'
ORDER BY cmd, policyname;

-- 3. Ver si la tabla tiene datos
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM user_question_history;

-- 4. Ver el trigger que está causando el problema
SELECT 
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'on_test_question_insert';

-- 5. Ver permisos en la tabla
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'user_question_history';