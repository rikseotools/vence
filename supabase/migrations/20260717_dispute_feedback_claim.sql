-- Claim/lease ligero para repartir las colas de impugnaciones y feedback entre
-- múltiples sesiones de Claude Code (2-10) SIN que se pisen unas a otras.
--
-- Modelo: cada sesión "coge" (claim) la fila más antigua libre de forma atómica con
-- FOR UPDATE SKIP LOCKED (primitiva Postgres para repartir una cola entre N workers).
-- Sin cron ni "renew": un claim se considera libre si claimed_by IS NULL o si es
-- viejo (claimed_at < now() - 2h), de modo que una sesión que muera lo suelta sola.
-- El cierre (status -> resolved/rejected/dismissed) lo saca del pool por el filtro de status.
-- Backstop existente intacto: el endpoint /resolve devuelve 409 si ya estaba resuelta.
--
-- Aditivo y reversible (DROP COLUMN). No toca datos ni visibilidad.

ALTER TABLE public.question_disputes
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.psychometric_question_disputes
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

ALTER TABLE public.user_feedback
  ADD COLUMN IF NOT EXISTS claimed_by text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Índices parciales para que claim-next (buscar la más antigua libre por estado) sea barato.
CREATE INDEX IF NOT EXISTS idx_qd_claim
  ON public.question_disputes (created_at)
  WHERE status IN ('pending', 'appealed');

CREATE INDEX IF NOT EXISTS idx_pqd_claim
  ON public.psychometric_question_disputes (created_at)
  WHERE status IN ('pending', 'appealed');

CREATE INDEX IF NOT EXISTS idx_uf_claim
  ON public.user_feedback (created_at)
  WHERE status = 'pending';

COMMENT ON COLUMN public.question_disputes.claimed_by IS 'Sesión (id) de Claude Code que está revisando esta impugnación; NULL = libre. Ver scripts/impugnaciones/cola.cjs';
COMMENT ON COLUMN public.question_disputes.claimed_at IS 'Cuándo se cogió; un claim con claimed_at < now()-2h se considera abandonado y vuelve al pool';
