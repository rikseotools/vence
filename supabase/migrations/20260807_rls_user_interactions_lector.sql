-- T-168 (flota w1, 07/08/2026) — política RLS para que `vence_lector` pueda LEER
-- `user_interactions`.
--
-- ── EL BLOQUEO, MEDIDO ───────────────────────────────────────────────────────────────────────
-- `20260805_rol_lector_flota.sql` concede `GRANT SELECT ON ALL TABLES` a `vence_lector`, pero un
-- GRANT no basta si la tabla tiene RLS activo y CERO políticas: el motor deniega TODO a cualquiera
-- que no sea el dueño — el mismo mecanismo ya diagnosticado y corregido para
-- `question_disputes`/`psychometric_question_disputes` (T-486), `ai_verification_results` (T-038),
-- `test_questions`/`tests` (T-573), `convocatoria_seguimiento_checks` (T-220) y
-- `question_lifecycle_history` (T-638).
--
-- Medido hoy investigando [T-168] (el deploy en caliente recarga la app a mitad de test): la ficha
-- pide cruzar `version_check_reload_immediate`/`version_check_reload_deferred` (eventos que
-- `useInteractionTracker` persiste en `user_interactions` vía `POST /api/interactions`) contra
-- `tests.is_completed=false` para medir el daño real. `user_interactions` tiene
-- `relrowsecurity=true` y CERO filas en `pg_policies` — `SELECT count(*) FROM user_interactions`
-- devuelve 0 SIEMPRE para `vence_lector`, sin error, indistinguible de una tabla vacía de verdad.
-- La tabla no está vacía: es donde aterriza CADA evento de `useInteractionTracker` (tests, chat,
-- navegación, UI…) de toda la app — el mismo falso verde de T-573/T-574, aquí bloqueando
-- cualquier investigación futura de este incidente y de cualquier otro que dependa de esta
-- telemetría (recuento de eventos por sesión, embudo de abandono, etc.).
--
-- ── POR QUÉ ES SEGURO ────────────────────────────────────────────────────────────────────────
-- Columnas: `id`, `user_id` (uuid, no correo/nombre), `session_id`, `event_type`,
-- `event_category`, `component`, `action`, `label`, `value` (jsonb de la propia interacción —
-- p.ej. `{clientVersion, newVersion, pathname}` para version-check), `page_url`, `element_id`,
-- `element_text`, `response_time_ms`, `device_info` (jsonb: plataforma/user-agent/resolución,
-- no identifica a la persona), `created_at`, `deploy_version`. Ningún identificador directo de
-- persona (correo, nombre, teléfono, IP, pago). Mismo perfil de riesgo que `test_questions`/
-- `question_lifecycle_history`: actividad por `user_id` (UUID), no un dato personal. Solo
-- SELECT — sigue sin poder escribir nada.
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.user_interactions;
CREATE POLICY flota_lector_lee ON public.user_interactions
  FOR SELECT TO vence_lector USING (true);

-- El supuesto sobre el que descansa esto: `vence_lector` ya tiene el GRANT de tabla (de
-- `20260805_rol_lector_flota.sql`) y no fue REVOCADO. Si algún día se revoca, la política de
-- aquí queda inocua sola (sin GRANT no hay nada que la política permita).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.role_table_grants
   WHERE grantee = 'vence_lector'
     AND table_schema = 'public'
     AND table_name = 'user_interactions'
     AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en user_interactions (tiene %): la política de esta migración no serviría de nada sin él (T-168)', n;
  END IF;
END $$;
