-- Migración: Índice único en laws.slug
-- Garantiza integridad: no puede haber dos leyes activas con el mismo slug.
-- Prerequisito para eliminar el diccionario hardcodeado de lawMappingUtils.
-- Creado: 2026-03-29

-- Índice parcial: solo aplica a filas con slug NOT NULL
-- Las 7 leyes inactivas sin slug no se ven afectadas.
CREATE UNIQUE INDEX IF NOT EXISTS laws_slug_unique
  ON laws (slug)
  WHERE slug IS NOT NULL;
