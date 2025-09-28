-- Función RPC para obtener nombres de usuarios para el ranking
-- Permite mostrar nombres públicos de forma segura

CREATE OR REPLACE FUNCTION get_user_names_for_ranking(user_ids uuid[])
RETURNS TABLE (
    id uuid,
    display_name text,
    email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id,
        COALESCE(
            au.raw_user_meta_data->>'full_name',
            au.raw_user_meta_data->>'name', 
            split_part(au.email, '@', 1)
        ) as display_name,
        au.email
    FROM auth.users au
    WHERE au.id = ANY(user_ids);
END;
$$;

-- Dar permisos para que usuarios autenticados puedan usar la función
GRANT EXECUTE ON FUNCTION get_user_names_for_ranking TO authenticated;

COMMENT ON FUNCTION get_user_names_for_ranking IS 'Obtiene nombres de usuarios para mostrar en el ranking de forma segura';