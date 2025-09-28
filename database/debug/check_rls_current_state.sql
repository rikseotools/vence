-- Ver estado actual de RLS y políticas en user_question_history
-- =====================================================

-- 1. Ver si RLS está habilitado en la tabla
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    forcerowsecurity as force_rls
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

-- 3. Ver la estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_question_history'
ORDER BY ordinal_position;

-- 4. Ver si la tabla tiene datos
SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users,
    MIN(created_at) as oldest_record,
    MAX(created_at) as newest_record
FROM user_question_history;

-- 5. Ver el trigger que está causando el problema
SELECT 
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name = 'on_test_question_insert';

-- 6. Ver la función del trigger
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'update_user_question_history';

-- 7. Ver permisos en la tabla
SELECT 
    grantee,
    privilege_type,
    is_grantable
FROM information_schema.table_privileges 
WHERE table_name = 'user_question_history';

-- 8. Ver el usuario actual de la conexión
SELECT 
    current_user as current_db_user,
    session_user,
    current_setting('role') as current_role;