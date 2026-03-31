-- Separar grupo y subgrupo en la tabla oposiciones
-- Antes: columna 'grupo' contenía el subgrupo (C1, C2, A1, A2)
-- Ahora: 'subgrupo' = C1/C2/A1/A2/B, 'grupo' = A/B/C

-- 1. Añadir columna subgrupo
ALTER TABLE oposiciones ADD COLUMN IF NOT EXISTS subgrupo text;

-- 2. Copiar valores actuales de grupo a subgrupo (que realmente son subgrupos)
UPDATE oposiciones SET subgrupo = grupo WHERE grupo IS NOT NULL;

-- 3. Actualizar grupo con el grupo real derivado del subgrupo
UPDATE oposiciones SET grupo =
  CASE
    WHEN subgrupo IN ('A1', 'A2') THEN 'A'
    WHEN subgrupo = 'B' THEN 'B'
    WHEN subgrupo IN ('C1', 'C2') THEN 'C'
    ELSE NULL
  END
WHERE subgrupo IS NOT NULL;

-- 4. Comentarios para documentar
COMMENT ON COLUMN oposiciones.grupo IS 'Grupo de clasificación: A, B, C';
COMMENT ON COLUMN oposiciones.subgrupo IS 'Subgrupo de clasificación: A1, A2, B, C1, C2';
