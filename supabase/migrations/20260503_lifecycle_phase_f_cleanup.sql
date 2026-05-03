-- Migration: lifecycle_phase_f_cleanup (Fase F del roadmap question lifecycle)
-- 2026-05-03
--
-- Roadmap completo: docs/roadmap/sistema-desactivacion-preguntas.md
--
-- ============================================================================
-- QUÉ HACE
-- ============================================================================
-- 1. Crear función cron-friendly: degradar a draft las legacy approved sin verificar
--    (decisión #1 del roadmap: 90d grandfather)
-- 2. NO eliminamos topic_review_status, verification_status, deactivation_reason —
--    SIGUEN escribiéndose por los writers legacy (verify endpoint + updateQuestionStatus)
--    como fuente histórica/legacy. Su eliminación es un proyecto aparte que requiere
--    auditoría de readers (admin UI, queries de stats, etc.)
-- 3. Comentamos las columnas legacy con DEPRECATED para indicar que son fuente
--    legacy y la fuente de verdad es lifecycle_state.
--
-- POR QUÉ NO DROP de columnas legacy
-- ============================================================================
-- Inicialmente fase F preveía DROP de topic_review_status, verification_status,
-- deactivation_reason. Pero auditando el código encontramos:
-- - 11 funciones SQL referencian topic_review_status (get_topic_questions_v2, etc.)
-- - admin UI components muestran badges por topic_review_status
-- - Queries de stats agregan por topic_review_status
-- - Tests usan estos campos en mocks
--
-- DROP de estas columnas requiere migrar TODOS esos consumers — trabajo
-- significativo que no aporta beneficio inmediato (las columnas son no-op
-- desde fase E, no contaminan invariantes). Mejor dejarlas como legacy hasta
-- que un proyecto futuro las elimine cuando todos los readers hayan migrado.
--
-- IDEMPOTENCIA: OR REPLACE.
--
-- REVERSIÓN
-- ============================================================================
--   DROP FUNCTION IF EXISTS public.lifecycle_grandfather_expire(integer);

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- ============================================================================
-- 1. Función cron grandfather: legacy approved sin verificar > 90d → draft
-- ============================================================================
-- Decisión #1 del roadmap: las 42.575 preguntas que estaban activas-nunca-
-- verificadas se mapearon a approved en backfill. Tras 90 días, las que aún
-- no tengan verified_at se degradan a draft (= invisible) hasta que pase QA.
--
-- Diseño: cursor + chunks de 500 filas, transition_question_state por cada
-- (para mantener audit trail completo). Si una transición falla (race con
-- otro update), continúa con la siguiente.
--
-- Llamar desde cron Vercel: SELECT public.lifecycle_grandfather_expire(90);
-- Devuelve número de preguntas degradadas.

CREATE OR REPLACE FUNCTION public.lifecycle_grandfather_expire(p_days_threshold integer DEFAULT 90)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_question_id uuid;
  v_count integer := 0;
  v_failed integer := 0;
  v_chunk_size integer := 500;
  v_processed integer := 0;
BEGIN
  FOR v_question_id IN
    SELECT id FROM public.questions
    WHERE lifecycle_state = 'approved'
      AND verified_at IS NULL
      AND created_at < NOW() - (p_days_threshold || ' days')::interval
    LIMIT v_chunk_size
  LOOP
    BEGIN
      PERFORM public.transition_question_state(
        v_question_id,
        'approved'::text,
        'draft'::text,
        'cron_legacy_grandfather_expired'::text,
        NULL,
        NULL,
        format('Auto-degradada por cron tras %s días sin verificar', p_days_threshold)
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE NOTICE 'Failed transition for %: %', v_question_id, SQLERRM;
    END;
    v_processed := v_processed + 1;
  END LOOP;

  RAISE NOTICE 'lifecycle_grandfather_expire: processed=%, degraded=%, failed=%',
    v_processed, v_count, v_failed;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.lifecycle_grandfather_expire IS
  'Cron: degrada a draft preguntas legacy approved sin verificar tras N días. '
  'Decisión #1 del roadmap lifecycle. Procesa hasta 500 por invocación '
  '(cron debería llamarla repetidamente). Devuelve número degradadas.';

REVOKE EXECUTE ON FUNCTION public.lifecycle_grandfather_expire(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lifecycle_grandfather_expire(integer) TO service_role;

-- ============================================================================
-- 2. Comentar columnas legacy (no DROP — ver comentario al inicio)
-- ============================================================================

COMMENT ON COLUMN public.questions.topic_review_status IS
  'DEPRECATED desde fase E (2026-05-03). Fuente legacy de estado. '
  'Fuente de verdad: lifecycle_state. Se mantiene escribiéndose por compatibilidad '
  'pero no debe usarse para nuevo código. Se eliminará cuando todos los readers '
  '(admin UI, funciones SQL get_topic_questions_v2 et al, tests) migren a lifecycle_state. '
  'Ver: docs/roadmap/sistema-desactivacion-preguntas.md fase F.';

COMMENT ON COLUMN public.questions.verification_status IS
  'DEPRECATED desde fase E (2026-05-03). Fuente legacy. Solo valores ok/problem/null. '
  'No se lee desde ningún sitio (verificado en audit). Candidato a DROP cuando se '
  'haga limpieza completa.';

COMMENT ON COLUMN public.questions.deactivation_reason IS
  'DEPRECATED desde fase E (2026-05-03). Texto libre legacy. Fuente de verdad ahora '
  'es reason_code en question_lifecycle_history (taxonomía cerrada). Se mantiene '
  'escribiéndose por algunos paths legacy para display en admin UI.';

COMMIT;

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- 1) Función creada:
--    SELECT proname FROM pg_proc WHERE proname='lifecycle_grandfather_expire';
--
-- 2) EXECUTE solo a service_role:
--    SELECT grantee FROM information_schema.routine_privileges
--    WHERE routine_name='lifecycle_grandfather_expire';
--
-- 3) Comentarios actualizados:
--    SELECT col_description('public.questions'::regclass, attnum)
--    FROM pg_attribute WHERE attrelid='public.questions'::regclass
--    AND attname IN ('topic_review_status','verification_status','deactivation_reason');
--
-- 4) Smoke test cron (sin filas a degradar — solo prueba la mecánica):
--    SELECT public.lifecycle_grandfather_expire(36500);  -- threshold gigante = 0 filas
--    Esperado: NOTICE processed=0, return 0
--
-- 5) Cuántas preguntas serán degradadas con threshold 90d HOY:
--    SELECT count(*) FROM questions
--    WHERE lifecycle_state='approved' AND verified_at IS NULL
--      AND created_at < NOW() - interval '90 days';
--    (informativo; no se ejecuta el cron aún)
