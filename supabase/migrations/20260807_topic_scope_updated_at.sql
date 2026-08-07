-- [T-607] topic_scope no tenía updated_at: un recorte de scope no dejaba rastro y
-- no había forma de saber, a posteriori, si una pregunta servida hace días estaba
-- realmente fuera de programa en el momento de servirse o si el scope cambió después.
-- Additiva: columna nullable con default now() para las filas nuevas, backfill de
-- las existentes con created_at (mejor aproximación disponible, no inventa un dato).

ALTER TABLE public.topic_scope
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.topic_scope
   SET updated_at = created_at
 WHERE updated_at IS NULL;

CREATE OR REPLACE FUNCTION public.tg_topic_scope_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topic_scope_updated_at ON public.topic_scope;
CREATE TRIGGER trg_topic_scope_updated_at
  BEFORE UPDATE ON public.topic_scope
  FOR EACH ROW EXECUTE FUNCTION public.tg_topic_scope_updated_at();

COMMENT ON COLUMN public.topic_scope.updated_at IS
  'Última vez que se tocó esta fila (article_numbers, title_numbers, etc). Backfill inicial = created_at. Sin esto no se puede distinguir una fuga de scope real de un re-vínculo/recorte posterior (T-607).';
