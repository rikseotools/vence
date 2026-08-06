-- T-613 (flota w2, 06/08/2026) — política RLS para que `vence_lector` pueda LEER
-- `user_interactions` y `user_interactions_archive`.
--
-- ── EL BLOQUEO, MEDIDO ───────────────────────────────────────────────────────────────────────
-- `20260805_rol_lector_flota.sql` concede `GRANT SELECT ON ALL TABLES` a `vence_lector`, pero un
-- GRANT no basta si la tabla tiene RLS activo y CERO políticas: el motor deniega TODO a cualquiera
-- que no sea el dueño — el mismo mecanismo ya diagnosticado y corregido para
-- `question_disputes`/`psychometric_question_disputes` (T-486), `ai_verification_results` (T-038),
-- `test_questions`/`tests` (T-573) y `convocatoria_seguimiento_checks` (T-220).
--
-- Medido hoy verificando [T-613] (los drenadores que borraban 50k/noche en vez de 2,5M): las dos
-- tablas tienen `relrowsecurity=true` y CERO filas en `pg_policies`, así que `vence_lector` ve la
-- tabla (el GRANT existe) pero cualquier SELECT devuelve 0 filas SIEMPRE — sin error. Las tablas
-- NO están vacías: `pg_stat_user_tables` (catálogo, visible sin RLS) muestra
-- `user_interactions` con 12.019.252 tuplas vivas / 10 GB el mismo día en que
-- `SELECT count(*) FROM user_interactions` devolvía **0**. Bloquea verificar si
-- `archive-interactions` (el drenador de T-613) está realmente bajando el atraso de filas
-- `created_at` fuera de retención: sin esto, «0 filas» es indistinguible de «tabla vacía».
--
-- ── POR QUÉ ES SEGURO ────────────────────────────────────────────────────────────────────────
-- `user_id`/`session_id` son UUIDs de ACTIVIDAD, no un identificador directo (correo, nombre,
-- teléfono, IP, pago). El resto son metadatos técnicos del evento (tipo, componente, acción,
-- página, tiempos, info de dispositivo). Mismo perfil de riesgo que `test_questions` y
-- `convocatoria_seguimiento_checks`. Solo SELECT — sigue sin poder escribir nada.
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.user_interactions;
CREATE POLICY flota_lector_lee ON public.user_interactions
  FOR SELECT TO vence_lector USING (true);

DROP POLICY IF EXISTS flota_lector_lee ON public.user_interactions_archive;
CREATE POLICY flota_lector_lee ON public.user_interactions_archive
  FOR SELECT TO vence_lector USING (true);
