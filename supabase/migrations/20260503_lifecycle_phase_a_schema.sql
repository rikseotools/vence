-- Migration: lifecycle_phase_a_schema (Fase A del roadmap question lifecycle)
-- 2026-05-03
--
-- Roadmap completo: docs/roadmap/sistema-desactivacion-preguntas.md
--
-- ============================================================================
-- QUÉ HACE ESTA MIGRACIÓN (fase A — aditiva pura, sin behavior change)
-- ============================================================================
-- 1. ADD COLUMN questions.lifecycle_state text NULL (sin default, CHECK acepta NULL)
-- 2. CREATE TABLE question_lifecycle_history (audit trail append-only)
-- 3. CREATE FUNCTION transition_question_state (única vía legítima de cambio)
--
-- QUÉ NO HACE (deliberado, va en fases posteriores)
-- ============================================================================
-- - NO toca is_active (sigue como bool normal hasta fase E)
-- - NO toca topic_review_status, verification_status, deactivation_reason (legacy
--   intacta hasta fase F)
-- - NO añade triggers ni REVOKE — eso es fase C, tras backfill, para que el
--   UPDATE masivo de fase B no dispare 102k entries falsas de bypass_detected
-- - NO setea valor en filas existentes — quedan NULL hasta backfill (fase B).
--   Por eso el CHECK acepta NULL temporalmente
--
-- REVERSIÓN (rollback fase A)
-- ============================================================================
--   DROP FUNCTION IF EXISTS public.transition_question_state(
--     uuid, text, text, text, uuid, uuid, text);
--   DROP TABLE IF EXISTS public.question_lifecycle_history;
--   ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_lifecycle_state_check;
--   ALTER TABLE public.questions DROP COLUMN IF EXISTS lifecycle_state;
--
-- IDEMPOTENTE: usa IF NOT EXISTS / OR REPLACE en todas las creaciones.

BEGIN;

-- ============================================================================
-- 1. ADD COLUMN questions.lifecycle_state
-- ============================================================================
-- Nullable durante backfill window (fase A → fase B). En fase B se hace
-- SET NOT NULL + SET DEFAULT 'draft' tras llenar todas las filas.

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS lifecycle_state text;

-- CHECK acepta los 8 valores oficiales OR NULL.
-- En fase B (final) se reemplaza por uno que rechaza NULL.
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_lifecycle_state_check;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_lifecycle_state_check CHECK (
    lifecycle_state IS NULL OR lifecycle_state IN (
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

-- Índice para queries por estado (admin filters, cron grandfather, batch-fix).
CREATE INDEX IF NOT EXISTS idx_questions_lifecycle_state
  ON public.questions (lifecycle_state);

-- Índice parcial para el caso "preguntas visibles" — el filtro más común
-- en hot path tras fase E (cuando is_active = lifecycle_state IN visible).
CREATE INDEX IF NOT EXISTS idx_questions_lifecycle_visible
  ON public.questions (lifecycle_state)
  WHERE lifecycle_state IN ('approved','tech_approved');

COMMENT ON COLUMN public.questions.lifecycle_state IS
  'State machine: draft|needs_review|needs_human|quarantine|approved|tech_approved|retired_duplicate|retired_irreparable. '
  'Se setea EXCLUSIVAMENTE vía función transition_question_state() (enforced en fase C). '
  'En fase E, is_active se vuelve GENERATED ALWAYS AS (lifecycle_state IN (approved, tech_approved)). '
  'NULL solo durante ventana de backfill (fase A → fase B). '
  'Ver: docs/roadmap/sistema-desactivacion-preguntas.md';

-- ============================================================================
-- 2. CREATE TABLE question_lifecycle_history
-- ============================================================================
-- Append-only audit trail. Una fila por cada transición + creación.
-- Garantía post fase C: toda pregunta tiene >= 1 fila aquí.

CREATE TABLE IF NOT EXISTS public.question_lifecycle_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id          uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  from_state           text,                  -- NULL solo en la fila de creación
  to_state             text NOT NULL,
  reason_code          text NOT NULL,         -- taxonomía cerrada en lib/constants/lifecycleReasons.ts
  changed_at           timestamptz NOT NULL DEFAULT now(),
  changed_by           uuid,                  -- NULL = sistema (cron, IA, backfill)
  ai_verification_id   uuid REFERENCES public.ai_verification_results(id) ON DELETE SET NULL,
  notes                text,                  -- libre, solo display

  CONSTRAINT qlh_to_state_check CHECK (to_state IN (
    'draft','needs_review','needs_human','quarantine',
    'approved','tech_approved','retired_duplicate','retired_irreparable'
  )),
  CONSTRAINT qlh_from_state_check CHECK (from_state IS NULL OR from_state IN (
    'draft','needs_review','needs_human','quarantine',
    'approved','tech_approved','retired_duplicate','retired_irreparable'
  ))
);

-- Índice principal: biografía de una pregunta cronológica descendente.
CREATE INDEX IF NOT EXISTS idx_qlh_question_id
  ON public.question_lifecycle_history (question_id, changed_at DESC);

-- Índice secundario: timeline global (admin dashboard "actividad reciente").
CREATE INDEX IF NOT EXISTS idx_qlh_changed_at
  ON public.question_lifecycle_history (changed_at DESC);

-- Índice secundario: queries por destino ("cuántas pasaron a needs_review hoy").
CREATE INDEX IF NOT EXISTS idx_qlh_to_state
  ON public.question_lifecycle_history (to_state);

COMMENT ON TABLE public.question_lifecycle_history IS
  'Audit trail append-only de transiciones de lifecycle_state. '
  'Toda escritura debe pasar por la función transition_question_state(); el trigger '
  'fallback (fase C) detecta y registra bypasses con reason_code=bypass_detected. '
  'Ver: docs/roadmap/sistema-desactivacion-preguntas.md §3.3';

-- RLS: solo admin lee. Negar todo a anon/authenticated por defecto.
ALTER TABLE public.question_lifecycle_history ENABLE ROW LEVEL SECURITY;

-- Política: nadie puede leer ni escribir desde el cliente. Solo service_role
-- (vía endpoints server-side) puede insertar; los SELECT van por funciones
-- SECURITY DEFINER específicas del admin panel (a crear en fase C).
-- No creamos política permisiva — el RLS habilitado sin política equivale
-- a deny-all para anon/authenticated, exactamente lo que queremos.

-- ============================================================================
-- 3. CREATE FUNCTION transition_question_state
-- ============================================================================
-- Única vía legítima de cambiar lifecycle_state. En fase C se completa el lock
-- con REVOKE UPDATE(lifecycle_state) y triggers fallback. En fase A la función
-- existe pero todavía no se llama desde ningún sitio (los escritores actuales
-- siguen tocando is_active+topic_review_status; se migran en fase D).

CREATE OR REPLACE FUNCTION public.transition_question_state(
  p_question_id        uuid,
  p_expected_state     text,
  p_new_state          text,
  p_reason_code        text,
  p_changed_by         uuid DEFAULT NULL,
  p_ai_verification_id uuid DEFAULT NULL,
  p_notes              text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current text;
BEGIN
  -- Validación temprana de p_new_state (evita llegar al UPDATE con basura).
  -- IMPORTANTE: chequear NULL explícitamente porque `NULL NOT IN (...)` evalúa
  -- a NULL (no TRUE), y en plpgsql `IF NULL` = FALSE → la cláusula no dispararía.
  -- Sin este IS NULL: NULL pasaría todas las validaciones, llegaría al INSERT
  -- en history y reventaría con "null value in column to_state" (mensaje inútil
  -- y en el lugar equivocado).
  IF p_new_state IS NULL OR p_new_state NOT IN (
    'draft','needs_review','needs_human','quarantine',
    'approved','tech_approved','retired_duplicate','retired_irreparable'
  ) THEN
    RAISE EXCEPTION 'Invalid p_new_state: %', COALESCE(p_new_state, 'NULL');
  END IF;

  IF p_reason_code IS NULL OR length(trim(p_reason_code)) = 0 THEN
    RAISE EXCEPTION 'p_reason_code is required';
  END IF;

  -- Marker transaction-local: el trigger fallback (fase C) lo lee para
  -- distinguir transiciones legítimas vía función vs UPDATEs directos.
  -- 3er argumento `true` = scope a la transacción actual (se descarta al COMMIT).
  PERFORM set_config('app.lifecycle_via_function', 'true', true);

  -- Lock + read current state. FOR UPDATE evita race con verificaciones IA
  -- concurrentes y otros admin clicks.
  SELECT lifecycle_state INTO v_current
  FROM public.questions
  WHERE id = p_question_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question % not found', p_question_id;
  END IF;

  -- Optimistic concurrency check: el caller debe pasar el estado que cree
  -- que tiene la pregunta. Si cambió entre su read y este UPDATE, se rechaza.
  -- Casos de uso: admin abre detalle (state=draft) y al hacer click la IA
  -- ya la movió a needs_review — el click falla con mensaje claro y la UI
  -- recarga. Sin esto, el click sobreescribiría silenciosamente.
  --
  -- Excepción: durante backfill (fase B) y migración inicial puede ser legítimo
  -- transicionar desde NULL. Aceptamos NULL como p_expected_state válido en ese caso.
  IF v_current IS DISTINCT FROM p_expected_state THEN
    RAISE EXCEPTION 'State mismatch on question %: expected %, got %',
      p_question_id, p_expected_state, COALESCE(v_current, 'NULL');
  END IF;

  -- No-op rejection: same-state transition. Evita contaminar history con ruido.
  IF v_current = p_new_state THEN
    RAISE EXCEPTION 'Same-state transition rejected: % -> %', v_current, p_new_state;
  END IF;

  -- Terminal states reject all out-transitions.
  -- Si una "retired" resulta recuperable, se crea pregunta nueva con FK
  -- a la jubilada como referencia (no se "resucita" la fila original).
  IF v_current IN ('retired_duplicate','retired_irreparable') THEN
    RAISE EXCEPTION 'Cannot transition from terminal state %', v_current;
  END IF;

  -- Reglas de transición legales (§3.1 del roadmap).
  -- Validación explícita por origen → destinos permitidos.
  -- Nota: NULL como origen se permite (caso backfill primigenio + escritores legacy
  -- en ventana fase A→D antes de que todos llamen a esta función).
  IF v_current IS NOT NULL THEN
    IF NOT (
      (v_current = 'draft'         AND p_new_state IN ('needs_review','needs_human','approved','tech_approved','quarantine','retired_duplicate','retired_irreparable'))
      OR (v_current = 'needs_review' AND p_new_state IN ('approved','tech_approved','needs_human','retired_duplicate','retired_irreparable'))
      OR (v_current = 'needs_human'  AND p_new_state IN ('approved','tech_approved','needs_review','retired_duplicate','retired_irreparable'))
      OR (v_current = 'quarantine'   AND p_new_state IN ('draft','retired_irreparable'))
      OR (v_current = 'approved'     AND p_new_state IN ('needs_review','needs_human','draft','retired_duplicate','retired_irreparable'))
      OR (v_current = 'tech_approved' AND p_new_state IN ('needs_review','needs_human','draft','retired_duplicate','retired_irreparable'))
    ) THEN
      RAISE EXCEPTION 'Illegal transition: % -> %', v_current, p_new_state;
    END IF;
  END IF;

  -- (Nota: approved/tech_approved → draft solo se usa para el cron
  -- legacy_grandfather_expired, decisión #1 del roadmap.)

  -- Update + history insert en la misma transacción.
  UPDATE public.questions
  SET lifecycle_state = p_new_state
  WHERE id = p_question_id;

  INSERT INTO public.question_lifecycle_history
    (question_id, from_state, to_state, reason_code, changed_by, ai_verification_id, notes)
  VALUES
    (p_question_id, v_current, p_new_state, p_reason_code, p_changed_by, p_ai_verification_id, p_notes);
END;
$$;

COMMENT ON FUNCTION public.transition_question_state IS
  'Única vía legítima de cambio de lifecycle_state. SECURITY DEFINER + check optimista '
  'de p_expected_state (anti-race) + validación de transiciones legales (§3.1 roadmap) + '
  'rechazo de transiciones desde estados terminales. Setea session var '
  'app.lifecycle_via_function que el trigger fallback (fase C) usa para distinguir '
  'transiciones legítimas vs bypasses. Ver: docs/roadmap/sistema-desactivacion-preguntas.md';

-- Limitar EXECUTE: solo service_role (server-side endpoints) puede invocar.
-- anon (browser sin login) y authenticated (usuario logueado normal) NO.
-- El admin panel pasa por endpoints API server-side que usan service_role.
REVOKE EXECUTE ON FUNCTION public.transition_question_state(uuid, text, text, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_question_state(uuid, text, text, text, uuid, uuid, text)
  TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar manualmente, no incluido en tx)
-- ============================================================================
-- 1) Columna existe y nullable:
--    SELECT column_name, is_nullable, column_default FROM information_schema.columns
--    WHERE table_name='questions' AND column_name='lifecycle_state';
--    Esperado: nullable=YES, default=NULL
--
-- 2) CHECK constraint instalado:
--    SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conname='questions_lifecycle_state_check';
--    Esperado: CHECK (lifecycle_state IS NULL OR lifecycle_state IN (...8 valores...))
--
-- 3) Tabla history existe y vacía:
--    SELECT count(*) FROM question_lifecycle_history;  -- esperado: 0
--
-- 4) Función creada y solo service_role puede ejecutar:
--    SELECT proname, prosecdef FROM pg_proc WHERE proname='transition_question_state';
--    SELECT grantee FROM information_schema.routine_privileges
--    WHERE routine_name='transition_question_state';
--    Esperado: prosecdef=true, grantee solo service_role
--
-- 5) Smoke test funcional (sobre 1 pregunta cualquiera):
--    BEGIN;
--    SELECT public.transition_question_state(
--      (SELECT id FROM questions LIMIT 1),
--      NULL,             -- expected_state actual (NULL antes de backfill)
--      'draft',
--      'smoke_test_phase_a',
--      NULL, NULL, 'Manual smoke test fase A — rollback inmediato'
--    );
--    -- Verificar:
--    SELECT lifecycle_state FROM questions WHERE id = (SELECT id FROM questions LIMIT 1);
--    SELECT * FROM question_lifecycle_history WHERE reason_code='smoke_test_phase_a';
--    ROLLBACK;  -- IMPORTANTE: deshacer el smoke test
--
-- 6) Smoke test rechazo NULL en p_new_state (bug fix verificado):
--    BEGIN;
--    SELECT public.transition_question_state(
--      (SELECT id FROM questions LIMIT 1), NULL, NULL, 'should_fail');
--    -- Esperado: ERROR 'Invalid p_new_state: NULL' (con mensaje correcto, no NOT NULL)
--    ROLLBACK;
--
-- 7) Smoke test rechazo p_reason_code vacío:
--    BEGIN;
--    SELECT public.transition_question_state(
--      (SELECT id FROM questions LIMIT 1), NULL, 'draft', '   ');
--    -- Esperado: ERROR 'p_reason_code is required'
--    ROLLBACK;
--
-- 8) Smoke test optimistic check anti-race:
--    BEGIN;
--    -- (asume pregunta cualquiera tiene lifecycle_state=NULL pre-backfill)
--    SELECT public.transition_question_state(
--      (SELECT id FROM questions LIMIT 1), 'approved', 'draft', 'should_fail');
--    -- Esperado: ERROR 'State mismatch on question ...: expected approved, got NULL'
--    ROLLBACK;
--
-- 9) Smoke test rechazo terminal (POST-backfill, fase B):
--    -- Con una pregunta en retired_irreparable:
--    BEGIN;
--    SELECT public.transition_question_state(
--      '<some_retired_id>', 'retired_irreparable', 'approved', 'should_fail');
--    -- Esperado: ERROR 'Cannot transition from terminal state retired_irreparable'
--    ROLLBACK;
