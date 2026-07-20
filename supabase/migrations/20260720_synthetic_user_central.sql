-- 20260720_synthetic_user_central.sql
--
-- Discriminador ÚNICO de usuario sintético (canaries / smoke user) a nivel de DATOS.
-- Hoy el único filtro es el string mágico `registration_source='internal_canary'`
-- repetido a mano en refresh_ranking_cache() (×4 ventanas) y en getStreakRanking
-- (lib/api/ranking/queries.ts), y la DIFICULTAD de preguntas NO lo excluye en
-- absoluto. Esta migración:
--   1. Añade user_profiles.is_synthetic (columna, fuente única) + backfill.
--   2. Blinda la dificultad POR CONTRATO: un trigger BEFORE INSERT en
--      question_first_attempts (y su espejo _pre_outbox) descarta las filas de
--      usuarios sintéticos → nunca entran en questions.global_difficulty. Un solo
--      chokepoint que cubre TODOS los paths (trigger track_question_first_attempt
--      + handler outbox + cualquier futuro), sin tocar cada uno.
--   3. Migra refresh_ranking_cache() del string a is_synthetic (4 ventanas).
--   4. Limpia la contaminación ya presente (borra las first_attempts sintéticas y
--      recomputa global_difficulty de las preguntas afectadas).
--
-- Diseño: docs/roadmap/canary-framework.md (P1). Additiva y reversible.
-- Nota: getStreakRanking (código de app) se migra en el mismo PR (queries.ts).

BEGIN;

-- ── 1. Columna fuente única + backfill ──
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_synthetic boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_profiles.is_synthetic IS
  'true = usuario sintético (canaries/smoke). Fuente ÚNICA de exclusión de analíticas (ranking, dificultad). Sustituye el string registration_source=''internal_canary''.';

UPDATE public.user_profiles
  SET is_synthetic = true
  WHERE registration_source = 'internal_canary' AND is_synthetic = false;

-- ── 2. Chokepoint: descartar first_attempts de sintéticos (blinda la dificultad) ──
CREATE OR REPLACE FUNCTION public.skip_synthetic_first_attempt()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- Si el usuario es sintético, NO insertamos la fila → questions.global_difficulty
  -- (que se re-agrega desde question_first_attempts) nunca ve datos de canaries.
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE id = NEW.user_id AND is_synthetic) THEN
    RETURN NULL;  -- BEFORE INSERT + NULL = fila descartada; el AFTER trigger no dispara.
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_skip_synthetic_first_attempt ON public.question_first_attempts;
CREATE TRIGGER trg_skip_synthetic_first_attempt
  BEFORE INSERT ON public.question_first_attempts
  FOR EACH ROW EXECUTE FUNCTION public.skip_synthetic_first_attempt();

DROP TRIGGER IF EXISTS trg_skip_synthetic_first_attempt ON public.question_first_attempts_pre_outbox;
CREATE TRIGGER trg_skip_synthetic_first_attempt
  BEFORE INSERT ON public.question_first_attempts_pre_outbox
  FOR EACH ROW EXECUTE FUNCTION public.skip_synthetic_first_attempt();

-- ── 3. refresh_ranking_cache(): string → is_synthetic (4 ventanas) ──
-- Sustituye `registration_source='internal_canary'` por `is_synthetic` sin cambiar
-- nada más del cuerpo (misma lógica de ventanas/HAVING/ON CONFLICT).
DO $migrate_rank$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_def FROM pg_proc WHERE proname = 'refresh_ranking_cache';
  v_def := replace(
    v_def,
    'SELECT id FROM user_profiles WHERE registration_source = ''internal_canary''',
    'SELECT id FROM user_profiles WHERE is_synthetic'
  );
  EXECUTE v_def;
END
$migrate_rank$;

-- ── 4. Limpiar contaminación ya presente + recomputar dificultad afectada ──
CREATE TEMP TABLE _affected_q ON COMMIT DROP AS
  SELECT DISTINCT qfa.question_id
  FROM public.question_first_attempts qfa
  JOIN public.user_profiles up ON up.id = qfa.user_id
  WHERE up.is_synthetic;

DELETE FROM public.question_first_attempts qfa
  USING public.user_profiles up
  WHERE up.id = qfa.user_id AND up.is_synthetic;

DELETE FROM public.question_first_attempts_pre_outbox qfa
  USING public.user_profiles up
  WHERE up.id = qfa.user_id AND up.is_synthetic;

-- Recomputar global_difficulty de las preguntas tocadas, con la MISMA fórmula que
-- apply_first_attempt_to_question_stats() (re-agrega desde question_first_attempts).
UPDATE public.questions q SET
  difficulty_sample_size        = agg.n,
  first_attempts_correct_sum    = agg.correct_sum,
  first_attempts_time_sum       = agg.time_sum,
  first_attempts_confidence_sum = agg.conf_sum,
  global_difficulty             = public.compute_global_difficulty_from_sums(agg.n, agg.correct_sum, agg.time_sum, agg.conf_sum),
  global_difficulty_category    = CASE
                                    WHEN public.compute_global_difficulty_from_sums(agg.n, agg.correct_sum, agg.time_sum, agg.conf_sum) IS NULL THEN NULL
                                    WHEN public.compute_global_difficulty_from_sums(agg.n, agg.correct_sum, agg.time_sum, agg.conf_sum) >= 75 THEN 'extreme'
                                    WHEN public.compute_global_difficulty_from_sums(agg.n, agg.correct_sum, agg.time_sum, agg.conf_sum) >= 50 THEN 'hard'
                                    WHEN public.compute_global_difficulty_from_sums(agg.n, agg.correct_sum, agg.time_sum, agg.conf_sum) >= 25 THEN 'medium'
                                    ELSE 'easy'
                                  END,
  difficulty_confidence         = LEAST(1.0, agg.n::numeric / 50.0),
  last_difficulty_update        = NOW()
FROM (
  SELECT question_id,
         count(*)::integer AS n,
         SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::integer AS correct_sum,
         SUM(COALESCE(time_spent_seconds, 0))::bigint AS time_sum,
         SUM(public.confidence_text_to_score(confidence_level))::numeric(12,2) AS conf_sum
  FROM public.question_first_attempts
  WHERE question_id IN (SELECT question_id FROM _affected_q)
  GROUP BY question_id
) agg
WHERE q.id = agg.question_id;

COMMIT;
