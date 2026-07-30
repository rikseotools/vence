-- 20260730_fraud_confirmations_persistente.sql
--
-- Que la marca de multicuenta SOBREVIVA al borrado de la cuenta.
--
-- ── EL PROBLEMA ─────────────────────────────────────────────────────────────
-- Hoy la marca vive en `fraud_watch_list.user_id` con **ON DELETE CASCADE**, igual que
-- `user_devices.user_id`. Si quien rota cuentas pide eliminar la suya, desaparecen la marca Y el
-- vínculo con su dispositivo: se registra de nuevo y empieza limpio. Es el agujero que señaló
-- Manuel — «que no pida eliminar y volverla a crear».
--
-- ── LA SOLUCIÓN ─────────────────────────────────────────────────────────────
-- `fraud_confirmations` ya existía con la forma correcta (device_id, user_ids, session_count,
-- action_taken) y **sin usar: 0 filas**. No cuelga de `user_profiles` con cascada, así que lo que
-- se escriba aquí sobrevive. Se le añade lo que le falta:
--
--   · `fingerprint`   — la huella de hardware v2 (`fp2_…`). Es el ancla REAL: el `device_id` vive
--                       en localStorage y se borra en dos clics; la huella se recalcula del equipo.
--   · `email_hashes`  — SHA-256 de los correos implicados, NO los correos. Permite reconocer a
--                       quien vuelve con el mismo email sin conservar el dato en claro. Si nunca
--                       vuelve, el hash no dice nada de nadie.
--   · `retention_until` — hasta cuándo se conserva. Marcar «para siempre» tras una baja solicitada
--                       choca con el derecho de supresión (RGPD art. 17); conservarlo un plazo
--                       acotado para prevención del fraude está amparado por el 17.3 y es
--                       defendible. Por defecto 2 años. Un equipo marcado en 2026 no puede seguir
--                       penalizado en 2032.
--
-- Aditiva y reversible: solo añade columnas a una tabla vacía.

ALTER TABLE public.fraud_confirmations
  ADD COLUMN IF NOT EXISTS fingerprint     text,
  ADD COLUMN IF NOT EXISTS email_hashes    text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS retention_until timestamptz
    DEFAULT (now() + interval '2 years');

COMMENT ON COLUMN public.fraud_confirmations.fingerprint IS
  'Huella de hardware v2 (fp2_). Ancla que sobrevive al borrado de localStorage Y de la cuenta.';
COMMENT ON COLUMN public.fraud_confirmations.email_hashes IS
  'SHA-256 de los correos implicados — nunca el correo en claro. Sirve para reconocer a quien '
  'borra su cuenta y se registra otra vez con el mismo email.';
COMMENT ON COLUMN public.fraud_confirmations.retention_until IS
  'Fecha de caducidad de la marca (por defecto 2 años). RGPD art. 17.3: la prevención del fraude '
  'justifica conservar, pero no indefinidamente.';

-- Una fila por dispositivo: reincidir actualiza, no duplica.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_fraud_confirmations_device
  ON public.fraud_confirmations (device_id)
  WHERE device_id IS NOT NULL;

-- Búsqueda por huella (el camino que se usa al detectar un re-registro).
CREATE INDEX IF NOT EXISTS idx_fraud_confirmations_fingerprint
  ON public.fraud_confirmations (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Búsqueda por hash de email: ¿este correo ya estuvo marcado?
CREATE INDEX IF NOT EXISTS idx_fraud_confirmations_email_hashes
  ON public.fraud_confirmations USING gin (email_hashes);
