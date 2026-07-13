-- Baseline silencioso de competidor nuevo (evita el flood del badge de Cambios).
--
-- Problema: el PRIMER sync de un competidor recién dado de alta ingesta su
-- catálogo entero como `course_added` → el badge de /admin/competidores (novedad
-- comercial pendiente) se dispara a "99+" con datos que no son novedad, y hay
-- que saldarlo a mano cada alta (caso Temarios Oficiales 13/07: 400 course_added).
--
-- Fix: `competitors.baseline_done`. Al completar el backfill inicial, el sync
-- auto-salda esos cambios y pone la bandera. Detalle: docs/runbooks/analizador-competidores.md §5.
ALTER TABLE public.competitors
  ADD COLUMN IF NOT EXISTS baseline_done boolean NOT NULL DEFAULT false;

-- Los competidores YA existentes completaron su baseline hace tiempo (sus
-- course_added iniciales ya se revisaron/saldaron). Marcarlos `true` para que su
-- próximo sync NO auto-salde cambios REALES. Solo las altas futuras arrancan en
-- false y hacen el baseline silencioso en su primer backfill.
UPDATE public.competitors SET baseline_done = true WHERE baseline_done = false;
