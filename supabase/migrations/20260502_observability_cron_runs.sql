-- Migration: observability_cron_runs
-- 2026-05-02
--
-- Sistema de observabilidad para crons. Tras el incidente del 17:14 CEST:
-- - validation_error_logs estaba vacio durante el incidente (porque
--   withErrorLogging usa pool max:1, si BD saturada el log mismo falla)
-- - No habia forma de saber que cron habia corrido cuando, ni cuanto tardo
-- - Detectamos correlacion entre incidente y un UPDATE batch del cron
--
-- Solucion: tabla cron_runs que cada cron actualiza con start/end/duration/
-- processed/error. Permite diagnosticar en 30s cualquier futuro incidente.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cron_name TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error', 'skipped')),
  processed INTEGER,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Índices para queries comunes (últimos N por cron, errores, runs en curso)
CREATE INDEX IF NOT EXISTS idx_cron_runs_cron_started
  ON public.cron_runs (cron_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_runs_running
  ON public.cron_runs (started_at) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS idx_cron_runs_errors
  ON public.cron_runs (started_at DESC) WHERE status = 'error';

-- Cleanup automatico: retener solo 30 dias (poner trigger? mejor cron)
-- Por ahora dejamos crecer; si llega a >100k filas, anadir job de limpieza.

REVOKE ALL ON public.cron_runs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.cron_runs TO service_role;

-- ============================================
-- Funciones helper para escribir logs SIN depender del pool max:1
-- ============================================
-- Los crons llaman estas funciones via supabase.rpc (PostgREST), que tiene su
-- propio pool. NO usan el getDb() Drizzle (que es max:1 y se satura).

-- Inserta una entrada de "running" y devuelve su id (para luego cerrar)
CREATE OR REPLACE FUNCTION public.cron_run_start(
  p_cron_name TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.cron_runs (cron_name, metadata)
  VALUES (p_cron_name, p_metadata)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Cierra una entrada (success o error)
CREATE OR REPLACE FUNCTION public.cron_run_end(
  p_run_id UUID,
  p_status TEXT,
  p_processed INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.cron_runs
  SET ended_at = now(),
      duration_ms = EXTRACT(EPOCH FROM (now() - started_at))::int * 1000,
      status = p_status,
      processed = COALESCE(p_processed, processed),
      error_message = p_error_message,
      metadata = COALESCE(p_metadata, metadata)
  WHERE id = p_run_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cron_run_start(TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cron_run_end(UUID, TEXT, INTEGER, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cron_run_start(TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.cron_run_end(UUID, TEXT, INTEGER, TEXT, JSONB) TO service_role;
