-- Migración: Añadir slug para URLs SEO-friendly
-- Fecha: 2026-01-11

-- Añadir columna slug
ALTER TABLE convocatorias_boe
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Crear índice para búsqueda por slug
CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_slug
ON convocatorias_boe(slug);

-- Función para generar slug desde título
CREATE OR REPLACE FUNCTION generate_convocatoria_slug(boe_id TEXT, titulo TEXT)
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
BEGIN
  -- Convertir a minúsculas, quitar acentos, reemplazar espacios
  slug := lower(unaccent(titulo));
  -- Quitar caracteres especiales excepto letras, números y espacios
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
  -- Reemplazar múltiples espacios por uno
  slug := regexp_replace(slug, '\s+', ' ', 'g');
  -- Reemplazar espacios por guiones
  slug := regexp_replace(slug, '\s', '-', 'g');
  -- Limitar longitud
  slug := left(slug, 80);
  -- Quitar guiones al final
  slug := regexp_replace(slug, '-+$', '', 'g');
  -- Añadir BOE ID al principio para unicidad
  slug := lower(regexp_replace(boe_id, '-', '-', 'g')) || '-' || slug;

  RETURN slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Actualizar convocatorias existentes con slug
UPDATE convocatorias_boe
SET slug = generate_convocatoria_slug(boe_id, COALESCE(titulo_limpio, titulo))
WHERE slug IS NULL;

-- Comentario
COMMENT ON COLUMN convocatorias_boe.slug IS 'URL slug SEO-friendly generado desde boe_id + titulo';
