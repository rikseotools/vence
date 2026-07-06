-- Analizador de Competidores — desglose de precios por PLAN/paquete
--
-- Un mismo curso/oposición puede tener VARIOS precios según lo que incluye:
-- solo tests · tests+temario · tests+temario+casos prácticos · etc. Eso es una
-- dimensión de PLAN, ortogonal a price_kind (matricula/cuota/…). Se añade:
--   plan     = nombre del paquete/tier (texto libre del competidor)
--   includes = qué incluye, estructurado (['tests','temario','casos_practicos',…])
-- La identidad de una línea de precio pasa a ser (course, kind, audience, period, plan).
-- Diseño: docs/roadmap/analizador-competidores.md

ALTER TABLE public.competitor_prices
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS includes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.competitor_prices.plan IS
  'Paquete/tier del precio (solo tests, tests+temario, tests+temario+casos…). Un curso puede tener varios.';
COMMENT ON COLUMN public.competitor_prices.includes IS
  'Qué incluye el paquete, estructurado: ["tests","temario","casos_practicos","videos",…].';
