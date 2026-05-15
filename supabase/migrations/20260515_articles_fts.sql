-- Full-Text Search para artículos legales.
-- Resuelve bug de búsqueda directa que ordenaba por article_number en lugar
-- de relevancia (ej. "plazo de posesión" en RD 364/1995 devolvía arts 1, 16, 18
-- en vez del art 48 que es el específicamente relevante).
--
-- Usa el stemmer 'spanish' de PostgreSQL: maneja plurales, conjugaciones,
-- stopwords del castellano automáticamente.
--
-- Estrategia (compatible con statement_timeout del pooler):
--  1. Columna nullable (sin GENERATED — sería pesado al añadirla a 41k+ rows)
--  2. Trigger BEFORE INSERT/UPDATE que la calcula automáticamente
--  3. Índice GIN (rápido en tablas pequeñas; recrear como CONCURRENTLY si crece)
--
-- El backfill de los 41k rows existentes se hace por batches en script separado
-- (scripts/backfill_articles_tsv.cjs) para no bloquear el pooler.

ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_tsv tsvector;

CREATE OR REPLACE FUNCTION articles_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.content_tsv :=
    setweight(to_tsvector('spanish', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(NEW.content, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_tsv_trigger ON articles;
CREATE TRIGGER articles_tsv_trigger
  BEFORE INSERT OR UPDATE OF title, content ON articles
  FOR EACH ROW EXECUTE FUNCTION articles_tsv_update();

CREATE INDEX IF NOT EXISTS idx_articles_content_tsv
  ON articles USING GIN (content_tsv);

COMMENT ON COLUMN articles.content_tsv IS
  'Full-text search vector (español). title pesa más (A) que content (B). Mantenida por trigger.';
