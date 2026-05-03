-- Migration: lifecycle_phase_b_backfill (Fase B del roadmap question lifecycle)
-- 2026-05-03
--
-- Roadmap completo: docs/roadmap/sistema-desactivacion-preguntas.md
--
-- ============================================================================
-- QUÉ HACE ESTA MIGRACIÓN (fase B — backfill 102k filas + tighten schema)
-- ============================================================================
-- 1. INSERT 102.230 filas en question_lifecycle_history (audit inicial)
-- 2. UPDATE 102.230 filas en questions con lifecycle_state mapeado desde
--    los 35 valores legacy de topic_review_status (+ patrones en deactivation_reason)
-- 3. ALTER lifecycle_state SET NOT NULL
-- 4. ALTER lifecycle_state SET DEFAULT 'draft' (para nuevos INSERTs)
-- 5. Reemplazar CHECK constraint para rechazar NULL (más estricto que en fase A)
-- 6. VERIFY interno: count(questions) == count(history) tras la transacción
--
-- DRY-RUN PROYECCIÓN (verificada 2026-05-03)
-- ============================================================================
--   approved              71.119
--   tech_approved         19.345
--   draft                  9.077
--   retired_duplicate      1.762
--   needs_human              576
--   needs_review             295
--   retired_irreparable       54
--   quarantine                 2
--   ------------------------------
--   TOTAL                102.230  ✓
--   Huérfanas:                 0  ✓
--
-- IMPACTO EN VISIBILIDAD A USUARIOS
-- ============================================================================
--   visible→visible:  90.464  (sin cambio)
--   oculta→oculta:    11.732  (sin cambio)
--   visible→oculta:       34  ← BUGS detectados (26 tech_bad_explanation +
--                                7 bad_explanation + 1 wrong_article_bad_answer)
--   oculta→visible:        0  (decisión #2: no auto-reactivar)
--
-- DECISIONES APLICADAS (de §6 del roadmap)
-- ============================================================================
-- #1: 42.575 activas-nunca-verificadas → approved (cron 90d en fase F las
--     degradará a draft si siguen sin verified_at)
-- #2: 1.193 desactivadas-pero-perfect → si reason indica retire→retired_*;
--     si no→needs_human (NO se reactivan en backfill)
-- #3: 1.134 huérfanas (NULL+NULL+deact) → draft
-- #4: psychometric_questions FUERA de scope (deuda explícita)
--
-- REGLA DE PRECEDENCIA (orden CASE WHEN, top-down)
-- ============================================================================
-- En filas DEACT, las reglas por TEXTO de deactivation_reason van ANTES que
-- las reglas por topic_review_status, porque el reason es típicamente más
-- reciente y específico (admin lo escribió a propósito) que el status (que
-- puede estar stale de una verificación antigua).
--
-- POR QUÉ NO USA transition_question_state()
-- ============================================================================
-- Backfill bulk: 102k llamadas a la función serializadas (FOR UPDATE row-level)
-- tardarían minutos. UPDATE bulk + INSERT bulk en transacción tarda segundos.
-- La función está diseñada para transiciones runtime con audit estricto;
-- el backfill es una operación controlada one-shot, audit explícito en notes.
--
-- IDEMPOTENCIA (rerun safety)
-- ============================================================================
-- - El UPDATE solo toca filas con lifecycle_state IS NULL (post-fase B = vacío).
-- - El INSERT en history solo añade si NO hay ya backfill_2026_05 para esa
--   pregunta (verificado con NOT EXISTS).
-- - Los ALTER son IF EXISTS / DROP+ADD donde aplique.
-- - Re-ejecutar la migración tras éxito es no-op (cero filas afectadas).
--
-- REVERSIÓN
-- ============================================================================
--   BEGIN;
--   ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_lifecycle_state_check;
--   ALTER TABLE public.questions ADD CONSTRAINT questions_lifecycle_state_check CHECK (
--     lifecycle_state IS NULL OR lifecycle_state IN (
--       'draft','needs_review','needs_human','quarantine',
--       'approved','tech_approved','retired_duplicate','retired_irreparable'));
--   ALTER TABLE public.questions ALTER COLUMN lifecycle_state DROP NOT NULL;
--   ALTER TABLE public.questions ALTER COLUMN lifecycle_state DROP DEFAULT;
--   UPDATE public.questions SET lifecycle_state = NULL;
--   DELETE FROM public.question_lifecycle_history WHERE reason_code='backfill_2026_05';
--   COMMIT;
--
-- POR QUÉ DOS TRANSACCIONES (incidente 2026-05-03)
-- ============================================================================
-- Primer intento de aplicar todo en una sola transacción terminó en DEADLOCK
-- al ejecutar los ALTER TABLE finales: con tráfico concurrente leyendo questions,
-- el AccessExclusiveLock de los ALTER no se podía tomar. Postgres declaró
-- nuestra transacción la víctima y rolleó TODO el backfill (102k filas perdidas).
--
-- Solución: dos transacciones.
--   - Tx 1 (data): INSERT history + UPDATE questions + verify. Solo row-level
--     locks → MVCC, no bloquea lecturas concurrentes. Commitea aunque haya
--     tráfico alto.
--   - Tx 2 (DDL): los 4 ALTER TABLE. Con SET LOCAL lock_timeout='5s', si no
--     puede tomar AccessExclusiveLock en 5 segundos, falla limpio (puede
--     retransmitirse manualmente sin perder los datos de Tx 1).
--
-- Si Tx 1 succeeds y Tx 2 falla: el schema queda en estado intermedio (datos
-- backfilled, pero columna sigue nullable sin default). Es seguro porque ya
-- todas las filas tienen valor válido. Re-correr la migración entera es
-- idempotente (Tx 1 NOT EXISTS guard, Tx 2 alteraciones idempotentes).

-- ============================================================================
-- TRANSACCIÓN 1: data (backfill + verify)
-- ============================================================================
BEGIN;

-- Subir statement_timeout para esta transacción (el pooler de Supabase pone
-- ~30-60s por defecto, insuficiente para regex sobre 102k filas).
SET LOCAL statement_timeout = '10min';

-- ============================================================================
-- 1. INSERT history seed (102k filas, una por pregunta)
-- ============================================================================
-- NOT EXISTS evita duplicar si la migración se re-ejecuta tras éxito parcial.
-- Las notas capturan el estado legacy completo para forensic future.

INSERT INTO public.question_lifecycle_history
  (question_id, from_state, to_state, reason_code, changed_by, ai_verification_id, notes)
SELECT
  q.id,
  NULL,
  CASE
    -- ===== ACTIVE rows =====
    WHEN q.is_active = true AND q.topic_review_status IN ('perfect','verified','verificado','verified_ok','reviewed','approved','ai_verified')
      THEN 'approved'
    WHEN q.is_active = true AND q.topic_review_status = 'tech_perfect'
      THEN 'tech_approved'
    WHEN q.is_active = true AND (q.topic_review_status = 'pending' OR q.topic_review_status IS NULL)
      THEN 'approved'  -- decisión #1: legacy grandfather + cron 90d (fase F)
    WHEN q.is_active = true AND q.topic_review_status IN ('bad_explanation','bad_answer','bad_answer_and_explanation','tech_bad_explanation','tech_bad_answer','tech_bad_answer_and_explanation','wrong_answer')
      THEN 'needs_review'
    WHEN q.is_active = true AND q.topic_review_status IN ('wrong_article','wrong_article_bad_answer','all_wrong','bad_article','out_of_scope','ambiguous','unverifiable','flagged','defective','tech_pending_adaptation','needs_review','deactivated','error','has_errors','discarded')
      THEN 'needs_human'
    -- ===== DEACTIVATED rows: reason-text rules first (más específicas) =====
    WHEN q.is_active = false AND q.deactivation_reason ~* 'duplicad|duplicate'
      THEN 'retired_duplicate'
    WHEN q.is_active = false AND q.deactivation_reason ~* '(imagen|figura|derogad|anulad|obsolet|outdated|ya no vigente|sustituid)'
      THEN 'retired_irreparable'
    WHEN q.is_active = false AND q.deactivation_reason ~* 'pendiente.*revisi[oó]n.*post.?importaci[oó]n'
      THEN 'draft'
    WHEN q.is_active = false AND q.deactivation_reason ~* '(art[ií]culo.*(vinculad|incorrect|placeholder)|sin art[ií]culo|wrong[_ ]article|no responde la pregunta|mal formulada|pipeline bug)'
      THEN 'needs_human'
    WHEN q.is_active = false AND q.deactivation_reason ~* '(respuesta.*(incorrect|err[oó]ne)|explicaci[oó]n.*(incorrect|insuficient)|answer_?ok\s*=\s*false|explanation_error|tech_bad_|dato incorrecto|bad_explanation|bad_answer|verification_failed|ninguna opci[oó]n)'
      THEN 'needs_review'
    -- ===== DEACTIVATED rows: status fallback =====
    WHEN q.is_active = false AND q.topic_review_status IN ('perfect','tech_perfect','verified','verificado','verified_ok','reviewed','approved','ai_verified')
      THEN 'needs_human'  -- decisión #2: NO auto-reactivar
    WHEN q.is_active = false AND q.topic_review_status IN ('bad_explanation','bad_answer','bad_answer_and_explanation','tech_bad_explanation','tech_bad_answer','tech_bad_answer_and_explanation','wrong_answer')
      THEN 'needs_review'
    WHEN q.is_active = false AND q.topic_review_status IN ('wrong_article','wrong_article_bad_answer','all_wrong','bad_article','out_of_scope','ambiguous','unverifiable','flagged','needs_review','defective','deactivated','error','has_errors','discarded')
      THEN 'needs_human'
    WHEN q.is_active = false AND q.topic_review_status IN ('invalid_structure','bad_options')
      THEN 'quarantine'
    WHEN q.is_active = false AND q.topic_review_status IN ('rejected','tech_pending_adaptation','outdated')
      THEN 'retired_irreparable'
    WHEN q.is_active = false AND q.topic_review_status = 'pending'
      THEN 'draft'
    WHEN q.is_active = false AND q.deactivation_reason IS NULL AND q.topic_review_status IS NULL
      THEN 'draft'  -- decisión #3: huérfanas puras
  END,
  'backfill_2026_05',
  NULL,
  NULL,
  'legacy: trs=' || COALESCE(q.topic_review_status,'NULL')
    || ', da=' || COALESCE(left(q.deactivation_reason, 200),'NULL')
    || ', was_active=' || q.is_active::text
FROM public.questions q
WHERE NOT EXISTS (
  SELECT 1 FROM public.question_lifecycle_history h
  WHERE h.question_id = q.id AND h.reason_code = 'backfill_2026_05'
);

-- ============================================================================
-- 2. UPDATE questions.lifecycle_state desde history insertada
-- ============================================================================
-- Tomamos to_state de la fila de history que acabamos de insertar.
-- Esto garantiza que questions.lifecycle_state == history.to_state SIEMPRE
-- (no hay ventana donde se desincronicen).

UPDATE public.questions q
SET lifecycle_state = h.to_state
FROM public.question_lifecycle_history h
WHERE h.question_id = q.id
  AND h.reason_code = 'backfill_2026_05'
  AND q.lifecycle_state IS NULL;

-- ============================================================================
-- 3. VERIFY: failsafe — abortar si algo no cuadra
-- ============================================================================
-- Si esta verificación falla, RAISE EXCEPTION rollbackea toda la transacción.

DO $$
DECLARE
  v_total_questions int;
  v_total_history int;
  v_null_states int;
  v_invalid_states int;
BEGIN
  SELECT count(*) INTO v_total_questions FROM public.questions;
  SELECT count(*) INTO v_total_history FROM public.question_lifecycle_history WHERE reason_code = 'backfill_2026_05';
  SELECT count(*) INTO v_null_states FROM public.questions WHERE lifecycle_state IS NULL;
  SELECT count(*) INTO v_invalid_states FROM public.questions
    WHERE lifecycle_state IS NOT NULL
    AND lifecycle_state NOT IN ('draft','needs_review','needs_human','quarantine',
                                 'approved','tech_approved','retired_duplicate','retired_irreparable');

  IF v_total_questions <> v_total_history THEN
    RAISE EXCEPTION 'Backfill mismatch: questions=% history=% (deben coincidir)',
      v_total_questions, v_total_history;
  END IF;

  IF v_null_states <> 0 THEN
    RAISE EXCEPTION 'Backfill incompleto: % filas con lifecycle_state IS NULL', v_null_states;
  END IF;

  IF v_invalid_states <> 0 THEN
    RAISE EXCEPTION 'Backfill corrupto: % filas con lifecycle_state fuera del enum', v_invalid_states;
  END IF;

  RAISE NOTICE 'Backfill OK: % preguntas, % filas history, 0 huérfanas',
    v_total_questions, v_total_history;
END;
$$;

COMMIT;

-- ============================================================================
-- TRANSACCIÓN 2: DDL (tighten schema)
-- ============================================================================
-- Bloquea reads/writes en questions ~1s para 4 ALTER. Con lock_timeout=5s,
-- si el lock está contendido falla limpio sin deadlock.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================================
-- 4. TIGHTEN SCHEMA: NOT NULL + DEFAULT 'draft' + CHECK sin NULL
-- ============================================================================
-- Solo se llega aquí si la verificación anterior pasó (todas las filas
-- tienen un valor válido). Estos ALTER son metadata-only en este punto.

ALTER TABLE public.questions
  ALTER COLUMN lifecycle_state SET NOT NULL;

ALTER TABLE public.questions
  ALTER COLUMN lifecycle_state SET DEFAULT 'draft';

-- Reemplazar CHECK fase A (que aceptaba NULL) por uno estricto.
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_lifecycle_state_check;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_lifecycle_state_check CHECK (
    lifecycle_state IN (
      'draft',
      'needs_review',
      'needs_human',
      'quarantine',
      'approved',
      'tech_approved',
      'retired_duplicate',
      'retired_irreparable'
    )
  );

-- Actualizar COMMENT con la nota de que ya está poblada.
COMMENT ON COLUMN public.questions.lifecycle_state IS
  'State machine: draft|needs_review|needs_human|quarantine|approved|tech_approved|retired_duplicate|retired_irreparable. '
  'Se setea EXCLUSIVAMENTE vía función transition_question_state() (enforcement en fase C). '
  'En fase E, is_active se vuelve GENERATED ALWAYS AS (lifecycle_state IN (approved, tech_approved)). '
  'Backfill inicial completado 2026-05-03 (fase B). '
  'Ver: docs/roadmap/sistema-desactivacion-preguntas.md';

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar manualmente, no incluido en tx)
-- ============================================================================
-- 1) Distribución de estados:
--    SELECT lifecycle_state, count(*) FROM questions GROUP BY 1 ORDER BY 2 DESC;
--    Esperado: approved=71119, tech_approved=19345, draft=9077, retired_duplicate=1762,
--              needs_human=576, needs_review=295, retired_irreparable=54, quarantine=2
--
-- 2) Cero NULLs:
--    SELECT count(*) FROM questions WHERE lifecycle_state IS NULL;  -- esperado: 0
--
-- 3) History coincide:
--    SELECT count(*) FROM question_lifecycle_history WHERE reason_code='backfill_2026_05';
--    Esperado: 102230
--
-- 4) Coherencia: cada pregunta tiene EXACTAMENTE 1 fila de backfill:
--    SELECT q.id FROM questions q
--    LEFT JOIN (SELECT question_id, count(*) AS c FROM question_lifecycle_history
--               WHERE reason_code='backfill_2026_05' GROUP BY 1) h ON h.question_id=q.id
--    WHERE h.c IS NULL OR h.c <> 1;
--    Esperado: 0 filas
--
-- 5) Coherencia: questions.lifecycle_state == history.to_state:
--    SELECT q.id FROM questions q JOIN question_lifecycle_history h ON h.question_id=q.id
--    WHERE h.reason_code='backfill_2026_05' AND q.lifecycle_state <> h.to_state;
--    Esperado: 0 filas
--
-- 6) is_active sigue intacto (sanity check fase B no debe haberlo tocado):
--    SELECT is_active, count(*) FROM questions GROUP BY 1;
--    Esperado: true=90498, false=11732 (mismos números que antes de fase B)
--
-- 7) Default + NOT NULL aplicados:
--    SELECT column_name, is_nullable, column_default FROM information_schema.columns
--    WHERE table_name='questions' AND column_name='lifecycle_state';
--    Esperado: nullable=NO, default='draft'::text
--
-- 8) CHECK estricto (sin NULL):
--    SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname='questions_lifecycle_state_check';
--    Esperado: CHECK (lifecycle_state = ANY (...8 valores...)) — sin "IS NULL OR"
