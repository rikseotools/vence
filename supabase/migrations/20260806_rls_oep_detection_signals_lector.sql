-- T-237 (06/08/2026) — política RLS para que `vence_lector` pueda LEER
-- `oep_detection_signals`.
--
-- ── EL BLOQUEO, MEDIDO ───────────────────────────────────────────────────────────────────────
-- `20260805_rol_lector_flota.sql` concede `GRANT SELECT ON ALL TABLES` a `vence_lector`, pero un
-- GRANT no basta si la tabla tiene RLS activo y CERO políticas: el motor deniega TODO a cualquiera
-- que no sea el dueño — el mismo mecanismo ya diagnosticado y corregido para
-- `question_disputes`/`psychometric_question_disputes` (T-486), `ai_verification_results`
-- (T-038), `test_questions`/`tests` (T-573) y `convocatoria_seguimiento_checks` (T-220), un sexto
-- caso.
--
-- Medido investigando [T-237] (por qué `detect-oep-llm` "muere a media pasada"): necesitaba leer
-- `oep_detection_signals` para contrastar la ficha contra el histórico real de señales del
-- sensor `llm_semantic`, y `SELECT count(*) FROM oep_detection_signals` con `vence_lector` da
-- SIEMPRE 0 — sin error, indistinguible de "la tabla está vacía". No lo está: `pg_class` confirma
-- `relrowsecurity=true` y `pg_policies` no tiene ninguna fila para esta tabla, mientras que
-- `information_schema.role_table_grants` sí tiene el SELECT de `vence_lector` — el GRANT existe,
-- RLS lo tapa igualmente. Bloquea CUALQUIER investigación del radar OEP (`docs/runbooks/
-- salud-radar.md`) hecha por un trabajador: sin esto no se puede triar una señal ni contrastar
-- cuántas produjo un sensor en un periodo dado.
--
-- ── POR QUÉ ES SEGURO ────────────────────────────────────────────────────────────────────────
-- Sin columna de identificador directo (correo, nombre, teléfono, IP, pago): `oposicion_id` y
-- `source_id` son UUIDs de CONTENIDO (una oposición, una fuente), `reviewed_by` es el UUID del
-- admin que revisó (no de la persona afectada), y el resto son metadatos técnicos de la
-- extracción (año, plazas, fecha, cuerpo detectado, resumen, `raw_extraction` jsonb con lo que
-- devolvió el LLM sobre una página PÚBLICA institucional). Mismo perfil de riesgo que
-- `ai_verification_results` y `convocatoria_seguimiento_checks`, ya concedidas. Solo SELECT —
-- sigue sin poder escribir nada.
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.oep_detection_signals;
CREATE POLICY flota_lector_lee ON public.oep_detection_signals
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
     AND table_name = 'oep_detection_signals'
     AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en oep_detection_signals (tiene %): la política de esta migración no serviría de nada sin él (T-237)', n;
  END IF;
END $$;
