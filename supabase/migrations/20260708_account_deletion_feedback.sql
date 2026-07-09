-- Encuesta de motivo en la BAJA DE CUENTA (paridad con cancellation_feedback).
--
-- Objetivo: capturar POR QUÉ el usuario se da de baja, para estadísticas de churn
-- (igual que hacemos en la cancelación de suscripción). Hasta ahora la baja no
-- preguntaba motivo (asimetría detectada 08/07/2026).
--
-- DIFERENCIA CLAVE con cancellation_feedback: aquí NO hay FK CASCADE a
-- user_profiles. La cuenta se ELIMINA al procesar la baja; con cascade, la fila
-- se borraría y perderíamos la estadística. Por eso `user_id` es un uuid plano
-- (sin FK) y la fila SOBREVIVE al borrado. Datos mínimos (motivo + segmentación),
-- RGPD-friendly: no se guarda nada más que lo necesario para el análisis agregado.

CREATE TABLE IF NOT EXISTS public.account_deletion_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- uuid plano SIN FK: sobrevive al borrado de la cuenta (a diferencia de cancellation_feedback).
  user_id          uuid,
  reason           text NOT NULL,          -- código del motivo (taxonomía cerrada en el front)
  reason_details   text,                    -- texto libre opcional ("Otro")
  plan_type        text,                    -- segmentación (free/premium al pedir la baja)
  target_oposicion text,                    -- segmentación por oposición
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_feedback_created
  ON public.account_deletion_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_deletion_feedback_reason
  ON public.account_deletion_feedback(reason);
