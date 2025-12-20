-- Verificar que los triggers estén creados correctamente
SELECT 
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers 
WHERE trigger_name IN ('on_user_profile_updated', 'on_auth_user_created', 'on_auth_user_updated');

-- Verificar que las funciones existan
SELECT 
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name IN ('sync_public_profile_from_user_profiles', 'sync_public_profile', 'get_user_display_name');

-- Ver el estado actual de los datos
SELECT 'user_profiles' as table_name, id, nickname, created_at, updated_at
FROM user_profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com')
UNION ALL
SELECT 'public_user_profiles' as table_name, id, display_name as nickname, created_at, updated_at
FROM public_user_profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com');