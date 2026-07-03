-- Drop de la función-trigger huérfana public.notify_temario_change().
-- Contexto: sus triggers se eliminaron el 16/04/2026 (20260416_drop_revalidate_triggers.sql)
-- por coste excesivo de ISR writes; la revalidación del temario es ahora APP-SIDE
-- (revalidateTag('temario'/'landing'/'laws') + POST /api/admin/revalidate-temario).
-- La función quedó huérfana y es el ÚNICO uso de pg_net (net.http_post) en el schema
-- de la app → bloqueaba la migración a RDS/Neon (pg_net no portable, §3.1 dry-run punto 5).
-- Verificado 2026-07-03 contra prod: 0 triggers la referencian, 0 funciones la llaman.
-- Reversible: recrear desde 20260406_webhook_revalidate_temario.sql si hiciera falta.
DROP FUNCTION IF EXISTS public.notify_temario_change();
