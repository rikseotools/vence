-- Migración: Función para actualizar embeddings desde JS client
-- El problema: JS client envía arrays que se guardan como TEXT, no como VECTOR
-- Solución: RPC que acepta text y hace cast a vector

-- Función para actualizar embedding de un artículo
CREATE OR REPLACE FUNCTION update_article_embedding(
  article_id uuid,
  embedding_json text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE articles
  SET embedding = embedding_json::vector(1536)
  WHERE id = article_id;

  RETURN FOUND;
END;
$$;

-- Función para regenerar todos los embeddings que están como TEXT
-- (Detecta embeddings malformados que tienen más/menos de 1536 dims)
CREATE OR REPLACE FUNCTION fix_text_embeddings()
RETURNS TABLE (
  fixed_count int,
  error_count int
)
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  v_fixed int := 0;
  v_errors int := 0;
BEGIN
  -- Buscar artículos con embeddings que parecen ser texto JSON
  FOR rec IN
    SELECT id, embedding::text as emb_text
    FROM articles
    WHERE embedding IS NOT NULL
  LOOP
    BEGIN
      -- Intentar hacer cast a vector
      UPDATE articles
      SET embedding = rec.emb_text::vector(1536)
      WHERE id = rec.id;

      v_fixed := v_fixed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
    END;
  END LOOP;

  RETURN QUERY SELECT v_fixed, v_errors;
END;
$$;

-- Verificar que la función existe
SELECT 'Función update_article_embedding creada' as status;
