-- Actualizar bucket para soportar más formatos de imagen incluyendo AVIF
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif'
]::text[]
WHERE id = 'user-avatars';

-- Verificar que se actualizó correctamente
SELECT id, name, allowed_mime_types
FROM storage.buckets
WHERE id = 'user-avatars';