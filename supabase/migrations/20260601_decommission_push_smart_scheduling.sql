-- 20260601_decommission_push_smart_scheduling.sql
-- Decommission del subsistema de "smart scheduling" de notificaciones push.
--
-- Contexto: el sistema de notificaciones push fue deshabilitado y ya no se usa
-- (confirmado por Manuel, 01/06/2026). El desmantelado se inició por fases
-- (commit 9a16991d "eliminar 8 endpoints API push - Fase 6/12"). Estos 4 objetos
-- son los restos del scheduler:
--   - vista  users_needing_notifications  (0 lectores de app; solo definida en migraciones)
--   - func   calculate_user_risk_level     (0 llamadores de app)
--   - tabla  user_smart_scheduling          (136 filas stale; único escritor era el
--            dead-code lib/notifications/userPatternAnalyzer.ts, ya borrado)
--   - tabla  user_activity_patterns         (0 filas)
--
-- NO se tocan las tablas de tracking/analítica de notificaciones que SIGUEN VIVAS
-- (notification_events, notification_logs, notification_metrics,
-- user_notification_metrics, user_notification_settings).
--
-- Backup de datos previo: backups/push_scheduling_decommission_backup.json (136+0 filas).
-- Referencias del cascade GDPR (lib/api/admin-delete-user/queries.ts) eliminadas en el
-- mismo cambio.
--
-- Orden por dependencias: la vista depende de las tablas -> primero la vista.

DROP VIEW IF EXISTS public.users_needing_notifications;
DROP FUNCTION IF EXISTS public.calculate_user_risk_level(uuid);
DROP TABLE IF EXISTS public.user_smart_scheduling;
DROP TABLE IF EXISTS public.user_activity_patterns;
