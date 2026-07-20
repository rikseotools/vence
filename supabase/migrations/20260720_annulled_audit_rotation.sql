-- T-009 — Rotación del audit de "incisos anulados por el TC" (STC) sin nota de vigencia.
--
-- POR QUÉ: el audit es pesado en red (357 leyes nacionales × llamadas a la API
-- datosabiertos del BOE, ~125 s en total → no cabe en el timeout de un endpoint).
-- Solución: recorrer el universo por ROTACIÓN — cada tick del cron audita las N
-- leyes MENOS-recientemente-auditadas, marcándolas con `annulled_audited_at`.
-- Con N=40 diario, el ciclo completo se recorre en ~9 días. Estado por-ley,
-- idempotente, escalable (si crece el universo, solo alarga el ciclo).
--
-- Additiva: columna nullable (NULL = nunca auditada → prioridad máxima en la rotación).

ALTER TABLE public.laws
  ADD COLUMN IF NOT EXISTS annulled_audited_at timestamptz;

COMMENT ON COLUMN public.laws.annulled_audited_at IS
  'Última auditoría de incisos anulados por el TC (cron audit-annulled-provisions, rotación). NULL = nunca auditada.';

-- Índice parcial para la cola de rotación: solo leyes candidatas (activas + BOE-A-),
-- ordenadas por antigüedad de auditoría (NULLS FIRST = nunca auditadas primero).
CREATE INDEX IF NOT EXISTS idx_laws_annulled_audit_rotation
  ON public.laws (annulled_audited_at NULLS FIRST)
  WHERE is_active = true AND boe_url ~* 'BOE-A-';
