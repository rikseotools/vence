-- Migration: lifecycle_phase_c_enforcement (Fase C del roadmap question lifecycle)
-- 2026-05-03
--
-- Roadmap completo: docs/roadmap/sistema-desactivacion-preguntas.md
--
-- ============================================================================
-- QUÉ HACE ESTA MIGRACIÓN (fase C — enforcement de triple bloqueo)
-- ============================================================================
-- Fases A+B + el fix manual de los 34 bugs YA están aplicadas. Esta cierra
-- el sistema añadiendo los mecanismos que evitan bypass:
--
-- 1. CREATE TRIGGER tg_questions_lifecycle_audit_insert (AFTER INSERT)
--    Auto-loga la creación de cada pregunta nueva en history.
--    Para INSERTs sin lifecycle_state explícito, registra el default 'draft'.
--
-- 2. CREATE TRIGGER tg_questions_lifecycle_audit_fallback (AFTER UPDATE OF lifecycle_state)
--    Detecta UPDATEs directos a lifecycle_state que no pasaron por
--    transition_question_state(). Lee session var 'app.lifecycle_via_function'
--    (que la función setea con set_config(.., true)). Si no está → log
--    bypass_detected. Imposible cambiar lifecycle_state sin dejar rastro.
--
-- 3. REVOKE UPDATE (lifecycle_state) ON questions FROM authenticated, anon
--    Defensa en profundidad: además del trigger fallback, las conexiones de
--    cliente (PostgREST) no pueden ni intentar cambiar la columna directamente.
--    service_role (server-side endpoints) sigue pudiendo, pero solo debe usar
--    la función SQL. El trigger pillaría cualquier bypass desde service_role.
--
-- 4. CREATE FUNCTION get_question_lifecycle_history (admin SELECT helper)
--    Permite al admin panel leer history sin necesidad de bajar RLS.
--    SECURITY DEFINER + EXECUTE solo a service_role.
--
-- POR QUÉ NO VAN ESTOS TRIGGERS EN FASE A
-- ============================================================================
-- Si fueran añadidos en fase A, el backfill masivo de fase B (UPDATE 102k filas)
-- habría disparado 102k entradas falsas de bypass_detected (Tx 1 NO usa la
-- función para no serializar 102k llamadas FOR UPDATE). Por eso van aquí, AHORA
-- que el backfill terminó.
--
-- POR QUÉ NO REVOKE EN FASE A (mismo motivo)
-- ============================================================================
-- En fase A no había datos en lifecycle_state. En fase B la migración bulk
-- necesitaba UPDATE directo (vía service_role) sobre lifecycle_state. Si REVOKE
-- estuviera puesto, fase B habría fallado con permission denied.
--
-- AHORA SÍ es el momento: fase B terminó, los datos están consistentes,
-- y de aquí en adelante toda transición debe ir vía la función.
--
-- IDEMPOTENCIA: usa OR REPLACE / DROP IF EXISTS donde aplique.
--
-- REVERSIÓN
-- ============================================================================
--   GRANT UPDATE (lifecycle_state) ON public.questions TO authenticated, anon;
--   DROP TRIGGER IF EXISTS tg_questions_lifecycle_audit_fallback ON public.questions;
--   DROP TRIGGER IF EXISTS tg_questions_lifecycle_audit_insert ON public.questions;
--   DROP FUNCTION IF EXISTS public.log_lifecycle_change_fallback() CASCADE;
--   DROP FUNCTION IF EXISTS public.log_lifecycle_initial() CASCADE;
--   DROP FUNCTION IF EXISTS public.get_question_lifecycle_history(uuid);

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================================
-- 1. Función + trigger AFTER INSERT (auto-log creación)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_lifecycle_initial() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.question_lifecycle_history
    (question_id, from_state, to_state, reason_code, notes)
  VALUES
    (NEW.id, NULL, NEW.lifecycle_state, 'created', 'Initial state on insert');
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_lifecycle_initial IS
  'Trigger AFTER INSERT en questions: registra automáticamente la creación '
  'de cada pregunta nueva en question_lifecycle_history. Garantiza que toda '
  'fila de questions tiene >= 1 entrada en history desde el momento de su INSERT.';

-- DROP+CREATE para idempotencia
DROP TRIGGER IF EXISTS tg_questions_lifecycle_audit_insert ON public.questions;

CREATE TRIGGER tg_questions_lifecycle_audit_insert
AFTER INSERT ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.log_lifecycle_initial();

-- ============================================================================
-- 2. Función + trigger AFTER UPDATE OF lifecycle_state (fallback bypass)
-- ============================================================================
-- Mecanismo: la función transition_question_state() setea
--   PERFORM set_config('app.lifecycle_via_function', 'true', true);
-- antes del UPDATE. Este trigger lee esa variable. Si está 'true', la
-- transición es legítima y la función ya escribió en history → no hace nada.
-- Si NO está 'true' (UPDATE directo bypass), inserta una fila de auditoría
-- con reason_code='bypass_detected' para que el admin lo investigue.

CREATE OR REPLACE FUNCTION public.log_lifecycle_change_fallback() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.lifecycle_state IS DISTINCT FROM NEW.lifecycle_state THEN
    -- IMPORTANTE: current_setting(_, true) devuelve NULL si la variable no existe.
    -- NULL <> 'true' = NULL; en plpgsql `IF NULL` se trata como FALSE → la rama
    -- NO se ejecutaría y los bypasses pasarían silenciosos. Verificado con smoke
    -- test 2026-05-03: sin coalesce, bypass detection NO dispara.
    -- coalesce convierte NULL a '' (string vacío); '' <> 'true' = TRUE → loga.
    IF coalesce(current_setting('app.lifecycle_via_function', true), '') <> 'true' THEN
      INSERT INTO public.question_lifecycle_history
        (question_id, from_state, to_state, reason_code, notes)
      VALUES
        (NEW.id, OLD.lifecycle_state, NEW.lifecycle_state, 'bypass_detected',
         'WARNING: lifecycle_state changed without transition_question_state() — investigate session/user');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.log_lifecycle_change_fallback IS
  'Trigger AFTER UPDATE OF lifecycle_state: red de seguridad anti-bypass. '
  'Detecta UPDATEs directos a lifecycle_state que no pasaron por '
  'transition_question_state() (que setea session var app.lifecycle_via_function). '
  'Loga reason_code=bypass_detected para detección. NO bloquea el UPDATE — solo audita.';

DROP TRIGGER IF EXISTS tg_questions_lifecycle_audit_fallback ON public.questions;

CREATE TRIGGER tg_questions_lifecycle_audit_fallback
AFTER UPDATE OF lifecycle_state ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.log_lifecycle_change_fallback();

-- ============================================================================
-- 3. REVOKE UPDATE column-level
-- ============================================================================
-- Defensa en profundidad: PostgREST (anon/authenticated) no podrá ni intentar
-- cambiar lifecycle_state directamente. El trigger fallback (#2) sigue activo
-- para cualquier conexión que tenga el permiso (service_role, postgres).
--
-- Nota: REVOKE column-level requiere que el role exista. anon/authenticated
-- son standard de Supabase, siempre presentes.

REVOKE UPDATE (lifecycle_state) ON public.questions FROM PUBLIC, anon, authenticated;

-- service_role mantiene UPDATE — los endpoints server-side lo necesitan,
-- pero deben usar transition_question_state(). El trigger #2 los pillaría
-- si hicieran UPDATE directo.

-- ============================================================================
-- 4. Helper SELECT history (admin panel necesita leer la audit trail)
-- ============================================================================
-- La tabla question_lifecycle_history tiene RLS deny-all (sin policies).
-- service_role bypassa RLS por defecto en Supabase, pero exponemos una
-- función explícita para que el admin panel tenga API limpia.

CREATE OR REPLACE FUNCTION public.get_question_lifecycle_history(p_question_id uuid)
RETURNS TABLE (
  id                   uuid,
  from_state           text,
  to_state             text,
  reason_code          text,
  changed_at           timestamptz,
  changed_by           uuid,
  ai_verification_id   uuid,
  notes                text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id, from_state, to_state, reason_code, changed_at, changed_by, ai_verification_id, notes
  FROM public.question_lifecycle_history
  WHERE question_id = p_question_id
  ORDER BY changed_at ASC;
$$;

COMMENT ON FUNCTION public.get_question_lifecycle_history IS
  'Lee la biografía completa de una pregunta. SECURITY DEFINER bypassa RLS. '
  'EXECUTE solo a service_role (admin panel server-side).';

REVOKE EXECUTE ON FUNCTION public.get_question_lifecycle_history(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_question_lifecycle_history(uuid) TO service_role;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================================================
-- 1) Triggers creados:
--    SELECT tgname FROM pg_trigger WHERE tgrelid='public.questions'::regclass
--    AND tgname LIKE '%lifecycle%';
--    Esperado: tg_questions_lifecycle_audit_insert, tg_questions_lifecycle_audit_fallback
--
-- 2) UPDATE column-level revocado:
--    SELECT grantee, privilege_type FROM information_schema.column_privileges
--    WHERE table_name='questions' AND column_name='lifecycle_state'
--    AND privilege_type='UPDATE' ORDER BY grantee;
--    Esperado: solo postgres y service_role (no anon, no authenticated)
--
-- 3) Smoke test bypass detection:
--    BEGIN;
--    -- Hacer UPDATE directo (como service_role lo permite, pero NO debe usarse).
--    UPDATE questions SET lifecycle_state = 'draft'
--      WHERE id = (SELECT id FROM questions WHERE lifecycle_state='approved' LIMIT 1);
--    -- Verificar que se generó entrada bypass_detected:
--    SELECT * FROM question_lifecycle_history
--      WHERE reason_code = 'bypass_detected'
--      ORDER BY changed_at DESC LIMIT 1;
--    -- Esperado: 1 fila con notes='WARNING: lifecycle_state changed without...'
--    ROLLBACK;
--
-- 4) Smoke test transición legítima NO genera bypass:
--    BEGIN;
--    SELECT public.transition_question_state(
--      (SELECT id FROM questions WHERE lifecycle_state='approved' LIMIT 1),
--      'approved', 'needs_review', 'admin_marked_problem'
--    );
--    -- Verificar que NO se generó bypass_detected en este segundo:
--    SELECT count(*) FROM question_lifecycle_history
--      WHERE reason_code='bypass_detected' AND changed_at >= now() - interval '5 seconds';
--    -- Esperado: 0
--    ROLLBACK;
--
-- 5) Smoke test trigger INSERT:
--    BEGIN;
--    INSERT INTO questions (id, question_text, option_a, option_b, option_c,
--      correct_option, explanation, primary_article_id)
--    VALUES (
--      gen_random_uuid(), 'TEST', 'a', 'b', 'c', 0, 'expl',
--      (SELECT id FROM articles LIMIT 1)
--    ) RETURNING id;
--    -- Verificar history:
--    SELECT to_state, reason_code FROM question_lifecycle_history
--      WHERE question_id = (SELECT id FROM questions WHERE question_text='TEST');
--    -- Esperado: to_state='draft' (default), reason_code='created'
--    ROLLBACK;
