-- T-530 (spinoff de T-573/T-574/T-638/T-639) — `vence_lector` puede leer `user_devices`: RLS
-- activo, cero políticas para ese rol, GRANT presente. MISMO mecanismo que T-573 ya arregló para
-- `test_questions`/`tests`.
--
-- ── CÓMO SE DESTAPÓ ─────────────────────────────────────────────────────────────────────────
-- Trabajando [T-530] (medir por qué la huella de hardware no reconoce la misma máquina en 30
-- casos), `SELECT count(*) FROM user_devices` con `VENCE_LECTOR_URL` no dio error: dio
-- `count(*) = 0`, indistinguible de "tabla vacía" salvo cruzando el catálogo. Medido en RDS
-- (07/08): `relrowsecurity = true`, `pg_policies` con esa tabla = 0 filas,
-- `information_schema.role_table_grants` confirma el SELECT concedido a `vence_lector`. Sin
-- esto, NINGÚN worker de la flota puede medir el propio hallazgo de T-530 (ni cualquier otra
-- tarea de antifraude por dispositivo: T-372, T-418, T-304).
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO (mismo criterio que T-573/T-638/T-639) ────────────────────
-- Columnas (db/schema.ts): id, user_id (uuid), device_id (texto generado por el cliente, NO un
-- identificador de persona), device_label (etiqueta de navegador/SO tipo "Chrome / Windows", no
-- personal), first_seen_at, last_seen_at, hw_fingerprint (hash opaco). Ningún correo, nombre,
-- teléfono, IP ni dato de pago. Mismo perfil de riesgo que `test_questions`/`tests`/
-- `daily_question_usage`, ya concedidas.
--
-- SELECT solamente, y solo `vence_lector` (NO `vence_coordinacion`).
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.user_devices;
CREATE POLICY flota_lector_lee ON public.user_devices
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
     AND table_name = 'user_devices'
     AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en user_devices (tiene %): la política de esta migración no serviría de nada sin él (T-530)', n;
  END IF;
END $$;
