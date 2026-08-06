-- Borrado RGPD asíncrono (T-215) — traza durable del resultado en segundo plano.
--
-- POR QUÉ (06/08/2026). El borrado completo (`delete_user_account()`) puede tardar hasta
-- ~190 s con el usuario más activo medido — muy por encima de lo que aguanta cualquier
-- ALB/CloudFront delante de la app. El endpoint responde 202 y ejecuta el borrado en
-- segundo plano (`after()` de Next), así que la respuesta HTTP YA NO es la fuente de la
-- verdad del resultado. Hacía falta un sitio DURABLE donde consultarlo:
--
--   `deleted_users_log.deletion_completed_at IS NULL` → sigue en curso (o falló antes de
--     poder marcarlo: comprobar `observable_events` con eventType
--     'admin_delete_user_background', o directamente `user_profiles`).
--   `deletion_completed_at` puesto → el borrado terminó con éxito (cuenta borrada, sin
--     errores críticos, email RGPD gestionado). Lo escribe la app, NO la función SQL
--     `delete_user_account()` — esta migración no la toca.
--
-- Distinto de `deleted_at` (misma tabla): esa columna tiene DEFAULT now() y se fija al
-- INSERTAR la fila de auditoría, ANTES de borrar nada — es "cuándo se pidió", no "cuándo
-- terminó". Confundirlas daría por completado un borrado que solo se ha solicitado.

ALTER TABLE deleted_users_log
  ADD COLUMN IF NOT EXISTS deletion_completed_at timestamptz;

COMMENT ON COLUMN deleted_users_log.deletion_completed_at IS
  'Cuándo terminó CON ÉXITO el borrado en segundo plano (T-215): cuenta confirmada borrada (user_profiles ausente) y sin errores críticos. NULL = todavía en curso, o falló antes de poder marcarlo (ver observable_events eventType admin_delete_user_background). NO confundir con deleted_at, que se fija al INSERTAR la fila de auditoría, antes del borrado.';
