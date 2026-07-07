-- Analizador de Competidores — TRIAJE de señales (acknowledge, sin perder histórico)
--
-- El badge contaba "cambios de 7d" a secas → mostraba señales YA revisadas hasta que
-- caducaban solas (ruido recurrente, no escala). Añadimos `reviewed_at`: marcar una
-- señal como revisada la saca del badge PERO la conserva en el log (auditoría). El
-- badge pasa a significar "movimiento comercial real sin triar". Idempotente.
-- Diseño: docs/roadmap/analizador-competidores.md

ALTER TABLE public.competitor_changes
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by text;

CREATE INDEX IF NOT EXISTS idx_competitor_changes_unreviewed
  ON public.competitor_changes (detected_at DESC)
  WHERE reviewed_at IS NULL;

-- Baseline: todo lo ya existente se considera revisado → el badge arranca en 0 y solo
-- se enciende con novedades POSTERIORES a este cambio.
UPDATE public.competitor_changes SET reviewed_at = now() WHERE reviewed_at IS NULL;
