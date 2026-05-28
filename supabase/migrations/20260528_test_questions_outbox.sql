-- Migración: Outbox Pattern para test_questions
-- Detonante: incidente 28/05/2026 (cascada 503 answer-and-save)
-- Roadmap: docs/roadmap/sprint-outbox-test-questions.md
-- Fase 1.1: schema outbox + trigger emisor (sin tocar los 27 triggers existentes)
--
-- Objetivo: registrar todos los eventos INSERT/UPDATE/DELETE de test_questions
-- en una tabla outbox para que un worker async (Fargate NestJS) los procese
-- fuera del path crítico. INSERT pasa de 10-25s (con 27 triggers en cascada)
-- a <100ms (solo escribe outbox).
--
-- Convivencia: los 27 triggers existentes siguen activos. El worker se irá
-- haciendo cargo de ellos en fases (1.3, 1.4) con shadow mode + paridad
-- bit-a-bit antes de DROP TRIGGER.
--
-- Reversible: DROP TRIGGER tg_test_questions_emit_outbox; DROP FUNCTION;
-- DROP TABLE test_questions_outbox;

BEGIN;

-- ============================================================================
-- 1. Tabla outbox
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.test_questions_outbox (
  id BIGSERIAL PRIMARY KEY,
  test_question_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('INSERT','UPDATE','DELETE')),
  payload JSONB NOT NULL,           -- snapshot NEW (INSERT/UPDATE)
  old_payload JSONB,                 -- snapshot OLD (UPDATE/DELETE)
  user_id UUID NOT NULL,             -- denormalizado para filtrar/sharding
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  error_message TEXT
);

COMMENT ON TABLE public.test_questions_outbox IS
  'Outbox de eventos de test_questions para procesamiento async por worker '
  'NestJS Fargate (outbox-processor). Reemplaza progresivamente los 20 '
  'triggers analíticos del path crítico de answer-and-save. Ver '
  'docs/roadmap/sprint-outbox-test-questions.md';

COMMENT ON COLUMN public.test_questions_outbox.payload IS
  'Snapshot completo del row tras la mutación (NEW en INSERT/UPDATE, OLD en DELETE). '
  'Permite al worker reconstruir el contexto sin volver a leer test_questions.';

COMMENT ON COLUMN public.test_questions_outbox.processed_at IS
  'NULL = pendiente. NOT NULL = procesado exitosamente. Worker usa FOR UPDATE '
  'SKIP LOCKED para evitar dobles procesamientos en paralelo.';

COMMENT ON COLUMN public.test_questions_outbox.retry_count IS
  'Incrementa en cada fallo. Si llega a 3, evento entra en DLQ (queda con '
  'processed_at=NULL y retry_count>=3). Inspección manual obligatoria.';

-- ============================================================================
-- 2. Índices
-- ============================================================================

-- Polling principal del worker: índice parcial cubriente sobre los pendientes.
-- Como processed_at NULL es lo único que el worker consulta, índice parcial
-- es óptimo (Postgres no indexa los procesados, espacio mínimo).
CREATE INDEX IF NOT EXISTS idx_outbox_unprocessed
  ON public.test_questions_outbox(created_at)
  WHERE processed_at IS NULL;

-- DLQ inspection: events con 3+ retries fallidos.
CREATE INDEX IF NOT EXISTS idx_outbox_errors
  ON public.test_questions_outbox(retry_count, created_at)
  WHERE retry_count >= 3 AND processed_at IS NULL;

-- ============================================================================
-- 3. Función trigger emisor
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tg_test_questions_emit_outbox()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.test_questions_outbox
      (test_question_id, event_type, payload, user_id)
    VALUES
      (NEW.id, 'INSERT', to_jsonb(NEW), NEW.user_id);
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.test_questions_outbox
      (test_question_id, event_type, payload, old_payload, user_id)
    VALUES
      (NEW.id, 'UPDATE', to_jsonb(NEW), to_jsonb(OLD), NEW.user_id);
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.test_questions_outbox
      (test_question_id, event_type, payload, old_payload, user_id)
    VALUES
      (OLD.id, 'DELETE', to_jsonb(OLD), to_jsonb(OLD), OLD.user_id);
    RETURN OLD;

  END IF;
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.tg_test_questions_emit_outbox IS
  'Trigger emisor del outbox: por cada INSERT/UPDATE/DELETE en test_questions, '
  'registra un evento en test_questions_outbox. Coste ~1ms (INSERT a tabla sin '
  'triggers ni FKs). Convivencia con los 27 triggers existentes hasta cutover.';

-- ============================================================================
-- 4. Trigger (AFTER para no bloquear el INSERT principal)
-- ============================================================================

DROP TRIGGER IF EXISTS tg_test_questions_emit_outbox ON public.test_questions;

CREATE TRIGGER tg_test_questions_emit_outbox
  AFTER INSERT OR UPDATE OR DELETE
  ON public.test_questions
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_test_questions_emit_outbox();

-- ============================================================================
-- 5. Permisos
-- ============================================================================

-- service_role (worker NestJS) puede leer/escribir/marcar procesado.
GRANT SELECT, UPDATE ON public.test_questions_outbox TO service_role;
GRANT USAGE ON SEQUENCE public.test_questions_outbox_id_seq TO service_role;

-- authenticated NO necesita acceso directo a outbox (lee solo a test_questions).

COMMIT;

-- ============================================================================
-- Smoke test post-migración (ejecutar manualmente):
-- ============================================================================
-- BEGIN;
--   INSERT INTO public.test_questions (id, test_id, user_id, ...)
--     VALUES (...);
--   SELECT * FROM public.test_questions_outbox ORDER BY id DESC LIMIT 1;
--   -- Debe haber 1 fila con event_type='INSERT' y payload con el row insertado.
-- ROLLBACK;
