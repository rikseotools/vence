-- T-639 (spinoff de T-450/T-573/T-574) — `vence_lector` puede leer `daily_question_usage`: RLS
-- activo, cero políticas para ese rol, GRANT presente. MISMO mecanismo que T-573 ya arregló para
-- `test_questions`/`tests`, en una tabla que se quedó fuera porque no estaba en `DEBE_LEER` de
-- `scripts/canary-rol-lector.cjs` en aquel momento.
--
-- ── CÓMO SE DESTAPÓ ─────────────────────────────────────────────────────────────────────────
-- Investigando [T-450] (el modo examen no cobra cupo diario): su propio canario
-- (`scripts/canary-cupo-vs-respuestas.cjs`) necesita `daily_question_usage` para comparar
-- respuestas reales contra cupo consumido, y con `VENCE_LECTOR_URL` fallaba con
-- "permission denied for table user_profiles" — un error DISTINTO del silencio de RLS. Al
-- aislar el JOIN y consultar `daily_question_usage` sola, no dio error: dio `count(*) = 0`,
-- indistinguible de "tabla vacía" salvo por cruzar el catálogo (mismo truco de
-- `lib/db/rlsSelectBlocked.cjs`, T-574). Medido en RDS (07/08):
--   `relrowsecurity = true`, `pg_policies` con esa tabla = 0 filas,
--   `information_schema.role_table_grants` confirma el SELECT concedido a `vence_lector`.
-- Ya estaba documentada como sospechosa (sin confirmar) en la lista de 85 tablas de T-574/T-573:
-- "daily_question_usage, psychometric_test_sessions… que podrían estar SILENCIOSAMENTE ciegas
-- igual que estas dos" — esto la confirma y la cierra.
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO (mismo criterio que T-573) ────────────────────────────────
-- Columnas (db/schema.ts): id, user_id (uuid), usage_date, questions_answered, last_question_at,
-- created_at, updated_at. Ningún identificador directo (correo, nombre, teléfono, IP, pago) —
-- solo actividad de cupo por usuario/día. Mismo perfil de riesgo que `test_questions`/`tests`,
-- ya concedidas. Las 3 políticas que YA tiene la tabla (`Users can read/insert/update own
-- usage`, para el rol `public` de Supabase Auth vía `auth.uid()`) no aplican a `vence_lector`
-- —roles distintos—, así que sin una política PROPIA el rol sigue viendo 0 filas siempre.
--
-- SELECT solamente, y solo `vence_lector` (NO `vence_coordinacion`: ese rol se queda en sus
-- tablas de coordinación — no necesita actividad de cupo para repartir trabajo).
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.daily_question_usage;
CREATE POLICY flota_lector_lee ON public.daily_question_usage
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
     AND table_name = 'daily_question_usage'
     AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en daily_question_usage (tiene %): la política de esta migración no serviría de nada sin él (T-639)', n;
  END IF;
END $$;
