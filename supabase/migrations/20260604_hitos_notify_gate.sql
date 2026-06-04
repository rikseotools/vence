-- 20260604_hitos_notify_gate.sql
-- Fase 8 (roadmap deteccion-convocatorias-oeps-completo.md §Fase 8) — paso 8b (BD).
--
-- Gate del GUARDARRAÍL "verificar a ciencia cierta antes de comunicar":
-- añade a convocatoria_hitos la severidad (→ canal) y el estado de notificación
-- (→ solo los 'verified' disparan fan-out). Un email NO puede salir de un dato
-- sin verificar; el cron solo propone ('pending'), Claude/humano verifica.
--
--   severity:
--     'critical'  → campana + email  (el opositor lo espera / actúa:
--                    apertura convocatoria/inscripción, fecha examen, listas
--                    provisionales/definitivas, plantilla del examen, resultados)
--     'important' → solo campana      (tribunal, aulas, ampliación plazo, cambio menor)
--     'cosmetic'  → nada
--
--   notify_status:
--     'pending'   → propuesto (cron) o histórico; NO notifica.
--     'verified'  → confirmado contra fuente oficial; elegible para fan-out.
--     'sent'      → fan-out realizado (lo marca el worker en 8c).
--
-- Hitos EXISTENTES se backfillean a 'pending' → jamás se notifican
-- retroactivamente (solo 'verified' dispara). severity histórica = 'important'
-- (neutra; da igual mientras notify_status='pending').
--
-- AGNÓSTICO A SUPABASE: solo columnas + CHECK + índice. Idempotente.

ALTER TABLE public.convocatoria_hitos
  ADD COLUMN IF NOT EXISTS severity      TEXT NOT NULL DEFAULT 'important',
  ADD COLUMN IF NOT EXISTS notify_status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'convocatoria_hitos_severity_check'
  ) THEN
    ALTER TABLE public.convocatoria_hitos
      ADD CONSTRAINT convocatoria_hitos_severity_check
      CHECK (severity IN ('critical', 'important', 'cosmetic'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'convocatoria_hitos_notify_status_check'
  ) THEN
    ALTER TABLE public.convocatoria_hitos
      ADD CONSTRAINT convocatoria_hitos_notify_status_check
      CHECK (notify_status IN ('pending', 'verified', 'sent'));
  END IF;
END $$;

COMMENT ON COLUMN public.convocatoria_hitos.severity IS
  'Fase 8: canal de notificación. critical=campana+email, important=solo campana, cosmetic=nada.';
COMMENT ON COLUMN public.convocatoria_hitos.notify_status IS
  'Fase 8 GUARDARRAÍL: pending=propuesto/histórico (no notifica), verified=confirmado vs fuente oficial (elegible fan-out), sent=fan-out hecho. Solo verified dispara.';

-- Índice para el worker de fan-out (8c): "hitos verificados pendientes de enviar".
CREATE INDEX IF NOT EXISTS idx_hitos_notify_ready
  ON public.convocatoria_hitos (notify_status, severity)
  WHERE notify_status = 'verified';
