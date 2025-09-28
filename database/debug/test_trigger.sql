-- Test manual del trigger
DO $$
DECLARE
    user_id_var UUID;
    old_nickname TEXT;
    new_nickname TEXT;
BEGIN
    -- Obtener el ID del usuario
    SELECT id INTO user_id_var FROM auth.users WHERE email = 'ilovetestpro@gmail.com';
    
    -- Obtener nickname actual
    SELECT nickname INTO old_nickname FROM user_profiles WHERE id = user_id_var;
    
    RAISE NOTICE 'Usuario ID: %', user_id_var;
    RAISE NOTICE 'Nickname actual: %', old_nickname;
    
    -- Hacer un UPDATE dummy para activar el trigger
    UPDATE user_profiles 
    SET updated_at = NOW() 
    WHERE id = user_id_var;
    
    RAISE NOTICE 'Trigger ejecutado (si existe)';
    
    -- Verificar el resultado
    SELECT display_name INTO new_nickname FROM public_user_profiles WHERE id = user_id_var;
    RAISE NOTICE 'Display name después del trigger: %', new_nickname;
    
END $$;