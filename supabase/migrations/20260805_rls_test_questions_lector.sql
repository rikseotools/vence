-- T-486 (flota) — política RLS para que `vence_lector` pueda LEER `test_questions`.
--
-- ── EL BLOQUEO, MEDIDO AL REFORZAR EL CANARIO PARA [T-038] ──────────────────────────────────
-- `20260805_rol_lector_flota.sql` ya declaraba `test_questions` en su propio `DEBE_LEER`
-- ("la actividad con la que se diagnostican los contadores") y concede `GRANT SELECT ON ALL
-- TABLES`. Pero un GRANT no basta si la tabla tiene RLS activo y CERO políticas: el motor deniega
-- TODO a cualquiera que no sea el dueño — mismo fallo ya corregido para
-- `question_disputes`/`psychometric_question_disputes` (`20260805_rls_impugnaciones_flota.sql`) y
-- para `ai_verification_results` (`20260805_rls_ai_verification_results_lector.sql`, del mismo lote).
-- El canario `scripts/canary-rol-lector.cjs` daba FALSO VERDE en esta tabla porque comprobaba
-- "SELECT 1 ... LIMIT 1 no lanzó error", y con RLS-sin-política el motor no lanza error: devuelve 0
-- filas en silencio. Reforzado a `count(*) > 0`, lo detectó de inmediato (160.310 preguntas en
-- `questions` visibles, 0 en `test_questions`).
--
-- ── POR QUÉ ES SEGURO (mismo criterio que T-486) ─────────────────────────────────────────────
-- La tabla identifica al usuario solo por `user_id` (UUID), que es exactamente lo que T-486 declaró
-- permitido ("se permite la ACTIVIDAD por user_id"). `user_agent`/`screen_resolution`/`timezone`
-- son metadatos de dispositivo, no identificadores directos de persona (correo/nombre/teléfono/IP).
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.test_questions;
CREATE POLICY flota_lector_lee ON public.test_questions
  FOR SELECT TO vence_lector USING (true);
