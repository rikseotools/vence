-- Analizador de Competidores — MATCH ESTRUCTURADO (ámbito/región) + enlaces sticky
--
-- El match por nombre falla porque una oposición es única por (ÁMBITO, REGIÓN), no
-- por su texto: "Técnico Auxiliar de Informática" del Estado ≠ de un Ayuntamiento ≠
-- de una Universidad. Añadimos identidad canónica al curso + método/confianza del
-- match + candidato de revisión, y hacemos los enlaces manuales/confirmados STICKY
-- (el re-match nunca los pisa). Idempotente.
-- Diseño: docs/roadmap/analizador-competidores.md

ALTER TABLE public.competitor_courses
  ADD COLUMN IF NOT EXISTS ambito            text,          -- estado|autonomica|local|universidad|desconocido
  ADD COLUMN IF NOT EXISTS region_slug       text,          -- CCAA/municipio/universidad canónico
  ADD COLUMN IF NOT EXISTS match_method      text NOT NULL DEFAULT 'none',  -- auto_structured|auto_name|needs_review|manual|confirmed|none
  ADD COLUMN IF NOT EXISTS match_confidence  real,          -- 0..1
  ADD COLUMN IF NOT EXISTS match_candidate_id uuid,         -- mejor apuesta cuando needs_review
  ADD COLUMN IF NOT EXISTS matched_at        timestamptz;

-- Taxonomía cerrada del método de match.
DO $$ BEGIN
  ALTER TABLE public.competitor_courses
    ADD CONSTRAINT competitor_courses_match_method_check
    CHECK (match_method IN ('auto_structured','auto_name','needs_review','manual','confirmed','none'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Índice para la cola de revisión (needs_review con candidato) y para reporting.
CREATE INDEX IF NOT EXISTS idx_competitor_courses_review
  ON public.competitor_courses (match_method)
  WHERE match_method = 'needs_review';

-- Los enlaces preexistentes emparejados por el matcher viejo quedan como 'auto_name'
-- (no sticky → el próximo re-match estructurado los revalida). Los que ya eran gap
-- siguen 'none'.
UPDATE public.competitor_courses
  SET match_method = 'auto_name', matched_at = now()
  WHERE oposicion_id IS NOT NULL AND match_method = 'none';
