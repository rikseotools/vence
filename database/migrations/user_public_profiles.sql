-- Tabla de perfiles públicos para mostrar en rankings
CREATE TABLE IF NOT EXISTS public_user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_public_user_profiles_display_name ON public_user_profiles(display_name);

-- Función para obtener display name siguiendo la lógica del perfil
-- Prioridad: 1) nickname de user_profiles, 2) primer nombre de full_name, 3) email antes del @
CREATE OR REPLACE FUNCTION get_user_display_name(user_id UUID, user_metadata JSONB, user_email TEXT)
RETURNS TEXT AS $$
DECLARE
    user_nickname TEXT;
    full_name TEXT;
    first_name TEXT;
BEGIN
    -- 1. Intentar obtener nickname de user_profiles
    SELECT nickname INTO user_nickname 
    FROM user_profiles 
    WHERE id = user_id;
    
    IF user_nickname IS NOT NULL AND trim(user_nickname) != '' THEN
        RETURN trim(user_nickname);
    END IF;
    
    -- 2. Extraer primer nombre de full_name (como hace getFirstName en el frontend)
    full_name := user_metadata->>'full_name';
    IF full_name IS NOT NULL AND trim(full_name) != '' THEN
        first_name := split_part(trim(full_name), ' ', 1);
        IF first_name IS NOT NULL AND trim(first_name) != '' THEN
            RETURN trim(first_name);
        END IF;
    END IF;
    
    -- 3. Usar parte del email antes del @
    IF user_email IS NOT NULL AND trim(user_email) != '' THEN
        RETURN split_part(user_email, '@', 1);
    END IF;
    
    -- 4. Fallback
    RETURN 'Usuario';
END;
$$ LANGUAGE plpgsql;

-- Función para crear/actualizar perfil automáticamente
CREATE OR REPLACE FUNCTION sync_public_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Para inserciones (nuevos usuarios)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public_user_profiles (id, display_name)
        VALUES (
            NEW.id,
            get_user_display_name(NEW.id, NEW.raw_user_meta_data, NEW.email)
        );
        RETURN NEW;
    END IF;
    
    -- Para actualizaciones (cambios de perfil)
    IF TG_OP = 'UPDATE' THEN
        -- Solo actualizar si cambió el metadata o el email
        IF OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data 
           OR OLD.email IS DISTINCT FROM NEW.email THEN
            
            UPDATE public_user_profiles 
            SET 
                display_name = get_user_display_name(NEW.id, NEW.raw_user_meta_data, NEW.email),
                updated_at = NOW()
            WHERE id = NEW.id;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Crear triggers para INSERT y UPDATE
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION sync_public_profile();

CREATE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION sync_public_profile();

-- Función para sincronizar cuando cambie el nickname en user_profiles
CREATE OR REPLACE FUNCTION sync_public_profile_from_user_profiles()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar public_user_profiles cuando cambie el nickname
    IF OLD.nickname IS DISTINCT FROM NEW.nickname THEN
        UPDATE public_user_profiles 
        SET 
            display_name = get_user_display_name(NEW.id, 
                (SELECT raw_user_meta_data FROM auth.users WHERE id = NEW.id),
                (SELECT email FROM auth.users WHERE id = NEW.id)
            ),
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para cambios en user_profiles
DROP TRIGGER IF EXISTS on_user_profile_updated ON user_profiles;
CREATE TRIGGER on_user_profile_updated
    AFTER UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION sync_public_profile_from_user_profiles();

-- Migrar usuarios existentes usando la función get_user_display_name
INSERT INTO public_user_profiles (id, display_name)
SELECT 
    id,
    get_user_display_name(id, raw_user_meta_data, email)
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- RLS para que solo se puedan leer los perfiles (no modificar)
ALTER TABLE public_user_profiles ENABLE ROW LEVEL SECURITY;

-- Política para que todos los usuarios autenticados puedan leer los perfiles públicos
CREATE POLICY "Public profiles are viewable by authenticated users" 
    ON public_user_profiles FOR SELECT 
    TO authenticated 
    USING (true);

-- Política para que solo el propietario pueda actualizar su perfil
CREATE POLICY "Users can update own profile" 
    ON public_user_profiles FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = id);

COMMENT ON TABLE public_user_profiles IS 'Perfiles públicos de usuarios para mostrar en rankings y competencias';