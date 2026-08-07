-- T-640 (spinoff de T-564/T-573/T-574/T-598/T-638/T-639/T-530) — `vence_lector` puede leer
-- `convocatoria_seguimiento_checks`: RLS activo, cero políticas para ese rol (ni para ninguno),
-- GRANT presente. MISMO mecanismo que T-573 arregló para `test_questions`/`tests`.
--
-- ── CÓMO SE DESTAPÓ ─────────────────────────────────────────────────────────────────────────
-- Trabajando [T-564] (detector de `seguimiento_change_status='error'`), quise leer
-- `error_message`/`http_status` del último check de cada oposición para clasificar el MOTIVO del
-- fallo. `SELECT count(*) FROM convocatoria_seguimiento_checks` con `VENCE_LECTOR_URL` no dio
-- error: dio `count(*) = 0`, indistinguible de "tabla vacía" salvo cruzando el catálogo — pero la
-- tabla NO está vacía (el cron inserta a diario; `oposiciones.seguimiento_last_checked` se
-- actualiza cada noche). Medido en RDS (07/08): `relrowsecurity = true`, `pg_policies` con esa
-- tabla = 0 filas (para NINGÚN rol), `information_schema.role_table_grants` confirma el SELECT
-- concedido a `vence_lector`. Sin esto, ningún worker de la flota puede leer la evidencia fina de
-- por qué falla un seguimiento (ni auditar/simular sobre esa tabla desde fuera del backend).
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO (mismo criterio que T-573/T-638/T-639/T-530) ──────────────
-- Columnas (db/schema.ts): id, oposicion_id (uuid), checked_at, content_hash, content_length,
-- http_status, has_changed, change_reviewed, reviewed_at, error_message, content_preview,
-- checked_url. Todo sobre PÁGINAS WEB PÚBLICAS de convocatorias oficiales y metadatos técnicos
-- del fetch — ningún correo, nombre, teléfono, IP ni dato de pago, ni de ningún usuario de la
-- app (esta tabla no tiene relación con personas). Mismo perfil de riesgo que
-- `test_questions`/`tests`/`daily_question_usage`/`user_devices`, ya concedidas.
--
-- SELECT solamente, y solo `vence_lector` (NO `vence_coordinacion`).
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.convocatoria_seguimiento_checks;
CREATE POLICY flota_lector_lee ON public.convocatoria_seguimiento_checks
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
     AND table_name = 'convocatoria_seguimiento_checks'
     AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en convocatoria_seguimiento_checks (tiene %): la política de esta migración no serviría de nada sin él (T-640)', n;
  END IF;
END $$;
