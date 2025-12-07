-- Crear bucket para avatares de usuario si no existe
-- NOTA: Este SQL debe ejecutarse en el SQL Editor de Supabase

-- Insertar el bucket (ignorar si ya existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-avatars',
  'user-avatars',
  true, -- Bucket público para que las imágenes sean accesibles
  2097152, -- 2MB límite de tamaño
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']::text[];

-- Política para permitir a usuarios autenticados subir sus propios avatares
CREATE POLICY "Users can upload their own avatar" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.uid()::text = split_part(name, '-', 2)
);

-- Política para permitir a usuarios autenticados actualizar sus propios avatares
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'user-avatars' AND
  auth.uid()::text = split_part(name, '-', 2)
);

-- Política para permitir a usuarios autenticados eliminar sus propios avatares
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'user-avatars' AND
  auth.uid()::text = split_part(name, '-', 2)
);

-- Política para permitir lectura pública de todos los avatares
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'user-avatars');

-- Comentario explicativo
COMMENT ON POLICY "Users can upload their own avatar" ON storage.objects IS
'Permite a usuarios autenticados subir avatares solo en su propio directorio (user_id en el nombre del archivo)';

COMMENT ON POLICY "Avatar images are publicly accessible" ON storage.objects IS
'Todos los avatares son públicos para que se puedan mostrar en perfiles y rankings';