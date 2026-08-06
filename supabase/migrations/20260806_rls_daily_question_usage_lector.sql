-- T-450 — `vence_lector` puede leer `daily_question_usage`: RLS activo, cero políticas.
--
-- ── EL MISMO BLOQUEO QUE `test_questions`/`tests` (T-573), UNA TABLA MÁS ───────────────────
-- `20260805_rol_lector_flota.sql` concedió `GRANT SELECT ON ALL TABLES IN SCHEMA public TO
-- vence_lector` y NO revocó `daily_question_usage` (no tiene identificador directo). Pero la
-- tabla tiene RLS activo (`relrowsecurity = true`) sin una sola política, así que el GRANT de
-- tabla no basta: el motor filtra en silencio y devuelve CERO filas siempre — no lanza error,
-- así que un canario que solo mira "¿lanzó?" lo da por bueno (mismo mecanismo de T-574/T-573,
-- `lib/db/rlsSelectBlocked.cjs`).
--
-- Medido en producción (06/08, investigando [T-450] — el cupo diario que el modo examen se
-- salta): `daily_question_usage` es EXACTAMENTE el tercer lado del triángulo que esa ficha
-- necesita comparar (`test_questions` = respuestas reales, `daily_question_usage` = contador
-- cobrado) y **T-573 no la cubrió** — su migración se acotó a las dos tablas que entonces
-- pedía `DEBE_LEER`, con guardarraíl propio que impide colar una tercera sin medir
-- (`__tests__/db/rlsTestQuestionsLectorMigration.test.js`, "no se cuela ninguna otra tabla").
-- Por eso va en un fichero nuevo, no ampliando el de T-573.
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO ─────────────────────────────────────────────────────────
-- `daily_question_usage` no tiene columna de identificador directo (correo, nombre, teléfono,
-- IP, pago): solo `user_id` (uuid), `usage_date`, `questions_answered` y dos timestamps. Mismo
-- perfil de riesgo que `test_questions`/`tests`, ya concedidas por el mismo motivo en T-573.
--
-- ⚠️ Esto NO basta para que un trabajador de la flota pueda ejecutar
-- `scripts/canary-cupo-vs-respuestas.cjs` tal cual está escrito: esa consulta hace JOIN con
-- `user_profiles.plan_type` y `NOT EXISTS` contra `user_subscriptions` — las dos BLOQUEADAS A
-- PROPÓSITO para `vence_lector` (PII/pago, ver `20260805_rol_lector_flota.sql`). Esa parte de
-- la reconciliación de [T-450] solo la puede correr una sesión con credenciales completas
-- (humana). Esta migración solo abre lo que SÍ es seguro para el rol de lectura.
--
-- SELECT solamente, y solo `vence_lector` (NO `vence_coordinacion`: ese rol se queda en sus 4
-- tablas de coordinación).
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.daily_question_usage;
CREATE POLICY flota_lector_lee ON public.daily_question_usage FOR SELECT TO vence_lector USING (true);

-- El supuesto sobre el que descansa esto: `vence_lector` ya tiene el GRANT de tabla (de
-- `20260805_rol_lector_flota.sql`, que no la revocó) y RLS está activo. Si algún día se revoca
-- el GRANT, la política de aquí queda inocua sola (sin GRANT no hay nada que la política permita).
-- Si algún día RLS se desactiva en esta tabla, la política queda inocua también (ya no se evalúa).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.role_table_grants
   WHERE grantee = 'vence_lector'
     AND table_schema = 'public'
     AND table_name = 'daily_question_usage'
     AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en daily_question_usage: la política de esta migración no serviría de nada sin él (T-450)';
  END IF;
END $$;
