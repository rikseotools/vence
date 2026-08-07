-- T-220 (flota w2, 06/08/2026) — política RLS para que `vence_lector` pueda LEER
-- `convocatoria_seguimiento_checks`.
--
-- ── EL BLOQUEO, MEDIDO ───────────────────────────────────────────────────────────────────────
-- `20260805_rol_lector_flota.sql` concede `GRANT SELECT ON ALL TABLES` a `vence_lector`, pero un
-- GRANT no basta si la tabla tiene RLS activo y CERO políticas: el motor deniega TODO a cualquiera
-- que no sea el dueño — el mismo mecanismo ya diagnosticado y corregido para
-- `question_disputes`/`psychometric_question_disputes` (T-486), `ai_verification_results` (T-038)
-- y `test_questions`/`tests` (T-573).
--
-- Medido hoy investigando [T-220]: `convocatoria_seguimiento_checks` tiene `relrowsecurity=true` y
-- CERO filas en `pg_policies`, así que `vence_lector` ve la tabla (el GRANT existe, confirmado en
-- `information_schema.role_table_grants`) pero cualquier SELECT devuelve 0 filas SIEMPRE — sin
-- error. La tabla no está vacía: el propio cron `check-seguimiento` escribe hoy mismo en
-- `oposiciones.seguimiento_last_checked` (126 oposiciones activas, 06/08 09:00-09:12 UTC) y en
-- `oposiciones.seguimiento_change_status` (26 con 'changed'), así que su tabla-log gemela no puede
-- estar realmente a cero — es el mismo falso verde de T-573/T-574: 0 filas indistinguible de
-- "tabla bloqueada" sin mirar el catálogo. Bloquea [T-220] (triar los cambios de seguimiento sin
-- revisar), que necesita leer el histórico de checks (hash, preview, http_status) para saber QUÉ
-- cambió en cada oposición, no solo que algo cambió.
--
-- ── POR QUÉ ES SEGURO ────────────────────────────────────────────────────────────────────────
-- La tabla no tiene ninguna columna de identificador directo (correo, nombre, teléfono, IP, pago):
-- `oposicion_id` es un UUID de CONTENIDO (una oposición, no una persona), y el resto son metadatos
-- técnicos del check (hash, longitud, status HTTP, vista previa del HTML de una página PÚBLICA
-- institucional). Mismo perfil de riesgo que `ai_verification_results`. Solo SELECT — sigue sin
-- poder escribir nada.
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.convocatoria_seguimiento_checks;
CREATE POLICY flota_lector_lee ON public.convocatoria_seguimiento_checks
  FOR SELECT TO vence_lector USING (true);
