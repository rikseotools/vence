-- Migration: lifecycle_phase_e_generated_active (Fase E del roadmap question lifecycle)
-- 2026-05-03
--
-- Roadmap completo: docs/roadmap/sistema-desactivacion-preguntas.md
--
-- ============================================================================
-- QUÉ HACE (la fase peligrosa — ahora segura tras pre-condiciones cumplidas)
-- ============================================================================
-- 1. DROP TRIGGER tg_questions_lifecycle_sync_active (BEFORE UPDATE) — innecesario
-- 2. DROP TRIGGER tg_questions_lifecycle_sync_active_insert (BEFORE INSERT) — innecesario
-- 3. DROP FUNCTION sync_is_active_from_lifecycle() — innecesaria
-- 4. DROP COLUMN questions.is_active (cero índices/constraints dependen de ella, verificado 2026-05-03)
-- 5. ADD COLUMN questions.is_active bool GENERATED ALWAYS AS
--      (lifecycle_state IN ('approved', 'tech_approved')) STORED
-- 6. CREATE INDEX parcial sobre is_active=true para hot path (89 readers)
--
-- POR QUÉ ES SEGURO AHORA
-- ============================================================================
-- Pre-condiciones verificadas 2026-05-03:
-- - Audit grep en app/lib: 0 escritores a questions.is_active (todos migrados en fase D)
-- - Verificación coherencia: 102.230/102.230 rows coherent (is_active == lifecycle visibility)
-- - Sync trigger fase D ha mantenido la coherencia desde su instalación
-- - Index audit: cero índices/constraints referencian is_active (DROP no rompe nada)
-- - One-shot scripts (scripts/_tmp_*.cjs) que setean is_active fallarán al re-correrse;
--   se considera aceptable (no son código productivo, ver task #7 follow-up)
--
-- INVARIANTE TRAS FASE E
-- ============================================================================
-- is_active = (lifecycle_state IN ('approved', 'tech_approved'))
-- Garantizado físicamente por el motor Postgres. Imposible que se desincronicen.
-- El bug original ("preguntas con bad_explanation seguían visibles") es físicamente
-- imposible a partir de aquí.
--
-- IMPACTO EN RUNTIME
-- ============================================================================
-- Lecturas: invariantes (todas las queries que filtran WHERE is_active=true siguen
-- funcionando exactamente igual). El planificador puede usar el nuevo índice
-- parcial idx_questions_is_active_true_v2 o el preexistente idx_questions_lifecycle_visible
-- (mismo plan).
--
-- Escrituras directas a is_active: ahora FALLAN con
--   ERROR: column "is_active" can only be updated to DEFAULT
-- Esto es deseable: cualquier código viejo que intente UPDATE is_active = X falla
-- ruidosamente y obliga a usar lifecycle_state vía función SQL.
--
-- IDEMPOTENCIA: usa IF EXISTS / OR REPLACE.
--
-- REVERSIÓN (compleja — las escrituras viejas no la harían trivial)
-- ============================================================================
--   BEGIN;
--   -- Snapshot is_active a una columna temporal antes de drop
--   ALTER TABLE public.questions ADD COLUMN is_active_legacy bool;
--   UPDATE public.questions SET is_active_legacy = is_active;
--   -- Drop generated, recrear como bool normal
--   ALTER TABLE public.questions DROP COLUMN is_active;
--   ALTER TABLE public.questions ADD COLUMN is_active bool DEFAULT true NOT NULL;
--   UPDATE public.questions SET is_active = is_active_legacy;
--   ALTER TABLE public.questions DROP COLUMN is_active_legacy;
--   -- Restaurar trigger sync
--   CREATE OR REPLACE FUNCTION public.sync_is_active_from_lifecycle() ... -- ver fase D.1
--   COMMIT;

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ============================================================================
-- 1. DROP triggers + función sync (innecesarios con generated column)
-- ============================================================================

DROP TRIGGER IF EXISTS tg_questions_lifecycle_sync_active ON public.questions;
DROP TRIGGER IF EXISTS tg_questions_lifecycle_sync_active_insert ON public.questions;
DROP FUNCTION IF EXISTS public.sync_is_active_from_lifecycle() CASCADE;

-- ============================================================================
-- 1b. DROP trigger preexistente que depende de is_active (re-creado al final)
-- ============================================================================
-- trigger_mark_embedding_stale dispara mark_article_embedding_stale() cuando
-- cambia question_text, is_active o primary_article_id. Necesario dropearlo
-- antes de DROP COLUMN is_active. Se recrea al final con UPDATE OF lifecycle_state
-- (porque UPDATE OF en columnas GENERATED NO dispara — Postgres lo prohíbe).

DROP TRIGGER IF EXISTS trigger_mark_embedding_stale ON public.questions;

-- ============================================================================
-- 2. DROP + ADD is_active como GENERATED column
-- ============================================================================
-- DROP destruye la columna actual. Ya hemos dropeado la única dependencia
-- (trigger_mark_embedding_stale). Cero índices/constraints adicionales — verificado.
-- ADD recrea como STORED computed: cada UPDATE/INSERT que cambie lifecycle_state
-- recalcula is_active automáticamente (a nivel motor, no aplicable bypass).

ALTER TABLE public.questions DROP COLUMN is_active;

ALTER TABLE public.questions ADD COLUMN is_active bool
  GENERATED ALWAYS AS (lifecycle_state IN ('approved', 'tech_approved')) STORED;

COMMENT ON COLUMN public.questions.is_active IS
  'Generated column: TRUE si lifecycle_state IN (approved, tech_approved). '
  'Imposible escribir directamente (Postgres rechaza con "cannot insert into column"). '
  'Para cambiar visibilidad: transition_question_state() vía endpoint admin. '
  'Ver: docs/roadmap/sistema-desactivacion-preguntas.md fase E.';

-- ============================================================================
-- 3. Índice parcial para hot path "WHERE is_active = true"
-- ============================================================================
-- Los 89 readers en app/ y lib/ filtran por is_active. Este índice asegura
-- que sigan rápidos. (idx_questions_lifecycle_visible es equivalente lógico
-- pero filtra por lifecycle_state — el planner debería elegir cualquiera.)

CREATE INDEX IF NOT EXISTS idx_questions_is_active_true_v2
  ON public.questions (is_active)
  WHERE is_active = true;

-- ============================================================================
-- 4. RE-CREATE trigger_mark_embedding_stale con UPDATE OF lifecycle_state
-- ============================================================================
-- Mismo comportamiento (marca artículos para regenerar embedding cuando cambia
-- visibilidad de pregunta) pero ahora sigue lifecycle_state — la única manera
-- de cambiar is_active. La función mark_article_embedding_stale() compara
-- OLD.is_active != NEW.is_active, ambos valores generados; sigue funcionando.

CREATE TRIGGER trigger_mark_embedding_stale
AFTER INSERT OR DELETE OR UPDATE OF question_text, lifecycle_state, primary_article_id
ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.mark_article_embedding_stale();

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- 1) is_active es ahora GENERATED:
--    SELECT column_name, is_generated, generation_expression
--    FROM information_schema.columns
--    WHERE table_name='questions' AND column_name='is_active';
--    Esperado: is_generated='ALWAYS', generation_expression=' lifecycle_state = ANY(...)'
--
-- 2) Counts iguales antes/después (no se debe haber perdido información):
--    SELECT is_active, count(*)::int AS rows FROM questions GROUP BY 1 ORDER BY 1 DESC;
--    Esperado: true=90464, false=11766 (igual que estado post-fix-manual)
--
-- 3) Trigger sync ya no existe:
--    SELECT count(*) FROM pg_trigger
--    WHERE tgrelid='public.questions'::regclass AND tgname LIKE '%sync_active%';
--    Esperado: 0
--
-- 4) Triggers audit/insert siguen activos:
--    SELECT tgname FROM pg_trigger WHERE tgrelid='public.questions'::regclass
--    AND tgname LIKE '%lifecycle%' ORDER BY tgname;
--    Esperado: tg_questions_lifecycle_audit_fallback, tg_questions_lifecycle_audit_insert
--
-- 5) Smoke test: UPDATE directo a is_active debe fallar:
--    BEGIN;
--    UPDATE questions SET is_active = false WHERE id = (SELECT id FROM questions LIMIT 1);
--    -- Esperado: ERROR "column 'is_active' can only be updated to DEFAULT"
--    ROLLBACK;
--
-- 6) Smoke test: transición lifecycle vía función propaga a is_active:
--    BEGIN;
--    SELECT public.transition_question_state(
--      (SELECT id FROM questions WHERE lifecycle_state='approved' LIMIT 1),
--      'approved', 'needs_review', 'admin_marked_problem'
--    );
--    SELECT lifecycle_state, is_active FROM questions WHERE id = (...);
--    -- Esperado: lifecycle_state='needs_review', is_active=false (auto-derivado)
--    ROLLBACK;
--
-- 7) Verificar índice creado:
--    SELECT indexname FROM pg_indexes WHERE tablename='questions' AND indexname='idx_questions_is_active_true_v2';
