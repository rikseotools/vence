-- Migration: añadir columna archived_data a deleted_users_log
-- Fecha: 2026-04-11
-- Motivo: RGPD — al eliminar un usuario, los datos con obligación legal
--         de retención (pagos, registros contables) no pueden borrarse
--         del todo. Se archivan de forma anonimizada en esta columna
--         como dump JSONB, manteniéndolos disponibles para auditoría
--         fiscal sin conservar su vínculo en las tablas operacionales.
--
-- Esta columna es OPCIONAL y se rellena durante la ejecución de
-- /api/admin/delete-user (ver lib/api/admin-delete-user/queries.ts).
-- Para registros antiguos (pre-migración) queda NULL.

ALTER TABLE deleted_users_log
  ADD COLUMN IF NOT EXISTS archived_data jsonb;

COMMENT ON COLUMN deleted_users_log.archived_data IS
  'Datos personales conservados por obligación legal (retención contable/fiscal) al eliminar el usuario. Se guarda como dump JSONB anonimizado del contenido de payment_settlements y otras tablas con retención legal, sin referencias FK vivas.';
