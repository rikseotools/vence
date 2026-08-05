-- T-038 (flota, 05/08/2026) — política RLS para que `vence_lector` pueda LEER `ai_verification_results`.
--
-- ── EL BLOQUEO, MEDIDO ───────────────────────────────────────────────────────────────────────
-- `20260805_rol_lector_flota.sql` concede `GRANT SELECT ON ALL TABLES` a `vence_lector`, pero un
-- GRANT no basta si la tabla tiene RLS activo y CERO políticas: el motor deniega TODO a cualquiera
-- que no sea el dueño — el mismo fallo ya diagnosticado y corregido para
-- `question_disputes`/`psychometric_question_disputes` en `20260805_rls_impugnaciones_flota.sql`.
-- Medido hoy: `ai_verification_results` tiene `relrowsecurity=true` y 0 filas en `pg_policies`, así
-- que `vence_lector` ve la tabla (el GRANT existe) pero cualquier SELECT devuelve 0 filas siempre.
-- Bloquea [T-038] (relink de `needs_human` + reescritura de explicaciones flojas), que necesita leer
-- qué campaña/proveedor marcó cada pregunta y con qué sugerencia de artículo — sin esta tabla la
-- tarea no se puede diagnosticar desde el rol de la flota.
--
-- ── POR QUÉ ES SEGURO (mismo criterio que T-486) ─────────────────────────────────────────────
-- La tabla no tiene ninguna columna de identificador directo (correo, nombre, teléfono, IP, pago):
-- solo `question_id`/`article_id`/`law_id` (UUIDs de CONTENIDO, no de persona) y texto de
-- veredicto/explicación generado por IA. `verified_by` es un UUID de `users` sin tabla que lo
-- traduzca a nombre desde este rol. Solo SELECT — sigue sin poder escribir nada.
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.ai_verification_results;
CREATE POLICY flota_lector_lee ON public.ai_verification_results
  FOR SELECT TO vence_lector USING (true);
