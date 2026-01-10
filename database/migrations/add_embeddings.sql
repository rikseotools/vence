-- Migración: Añadir embeddings para búsqueda semántica
-- Ejecutar en Supabase SQL Editor

-- 1. Añadir columna embedding a articles
ALTER TABLE articles ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 2. Crear índice para búsqueda rápida (IVFFlat)
CREATE INDEX IF NOT EXISTS articles_embedding_idx ON articles
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 3. Función para buscar artículos por similitud semántica
CREATE OR REPLACE FUNCTION match_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  article_number text,
  title text,
  content text,
  law_id uuid,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.article_number,
    a.title,
    a.content,
    a.law_id,
    1 - (a.embedding <=> query_embedding) as similarity
  FROM articles a
  WHERE a.is_active = true
    AND a.embedding IS NOT NULL
    AND 1 - (a.embedding <=> query_embedding) > match_threshold
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Verificar
SELECT 'Migración completada' as status;
