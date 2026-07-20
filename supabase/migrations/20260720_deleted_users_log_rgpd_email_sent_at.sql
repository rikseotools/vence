-- T-011 — Email RGPD de borrado *exactly-once*.
--
-- Problema: en DELETE /api/admin/delete-user, el correo de confirmación RGPD (Art. 12.3) puede
-- DUPLICARSE en el camino raro de reintento: si un 1er intento borró la cuenta y ENVIÓ el email
-- pero devolvió 500 por otra causa (p.ej. error del store de auth legacy), al reintentar
-- (user_profiles ya ausente) la ruta reenvía el email desde el email DURABLE de deleted_users_log.
-- El reintento ya no re-borra ni da 500 perpetuo (fix 4ef7a929), pero el email no es exactly-once.
--
-- Solución: un SELLO durable en la propia fila de auditoría. La ruta envía solo si sigue NULL y
-- lo sella tras el envío OK. Fail-open en la LECTURA del sello (si no se puede leer, se intenta
-- enviar) porque para el RGPD perder el correo legal es peor que un duplicado raro.
--
-- Additiva y NULL por defecto: las filas ya existentes quedan NULL ("no sabemos si se envió" —
-- que es la verdad para el histórico); el sello solo aplica a los borrados a partir de ahora.

ALTER TABLE public.deleted_users_log
  ADD COLUMN IF NOT EXISTS rgpd_email_sent_at timestamptz;

COMMENT ON COLUMN public.deleted_users_log.rgpd_email_sent_at IS
  'Sello de envío del email RGPD (Art. 12.3) de confirmación de borrado. NULL = aún no enviado '
  '(o histórico previo a T-011). La ruta delete-user envía solo si NULL y lo sella tras el envío '
  'OK → exactly-once en el reintento. Ver T-011.';
