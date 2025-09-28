-- Test simple: ¿funciona la función get_user_display_name?
SELECT 
    'Testing get_user_display_name function' as test,
    get_user_display_name(
        (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com'),
        (SELECT raw_user_meta_data FROM auth.users WHERE email = 'ilovetestpro@gmail.com'),
        'ilovetestpro@gmail.com'
    ) as result;

-- Comparar datos actuales
SELECT 
    'Current nickname in user_profiles' as source,
    nickname as value
FROM user_profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com')
UNION ALL
SELECT 
    'Current display_name in public_user_profiles' as source,
    display_name as value
FROM public_user_profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com');

-- Forzar sincronización manual
UPDATE public_user_profiles 
SET 
    display_name = get_user_display_name(
        id, 
        (SELECT raw_user_meta_data FROM auth.users WHERE id = public_user_profiles.id),
        (SELECT email FROM auth.users WHERE id = public_user_profiles.id)
    ),
    updated_at = NOW()
WHERE id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com');

-- Verificar resultado
SELECT 
    'After manual sync' as test,
    display_name as result
FROM public_user_profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'ilovetestpro@gmail.com');