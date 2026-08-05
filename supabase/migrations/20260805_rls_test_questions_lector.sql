-- T-486 / T-573 — `vence_lector` puede leer `test_questions` y `tests`: RLS activo, cero políticas.
--
-- ── EL MISMO BLOQUEO QUE `question_disputes` YA TUVO (T-574), OTRA VEZ ─────────────────────
-- `20260805_rol_lector_flota.sql` concedió `GRANT SELECT ON ALL TABLES IN SCHEMA public TO
-- vence_lector` — un permiso de TABLA. Pero `test_questions` y `tests` tienen RLS activo
-- (`relrowsecurity = true`) sin una sola política, y con RLS activo el GRANT de tabla no basta:
-- el motor filtra en silencio y devuelve CERO filas siempre, sea cual sea el contenido real —
-- no lanza error, así que un canario que solo mira "¿lanzó?" lo da por bueno (falso verde,
-- ya diagnosticado en T-574 para `question_disputes` y reproducido aquí con el mismo mecanismo:
-- `lib/db/rlsSelectBlocked.cjs` + `pg_class.relrowsecurity` cruzado con `pg_policies`).
--
-- Medido en producción (05/08): de las tablas que el trabajo REAL de la flota necesita leer
-- (`DEBE_LEER` en `scripts/canary-rol-lector.cjs`), `test_questions` es la única bloqueada así —
-- "la actividad con la que se diagnostican los contadores" (T-476, la primera tarea real de la
-- flota, chocó exactamente con esto). `tests` no está en `DEBE_LEER` pero la bloquea el mismo
-- mecanismo y la necesita `scripts/sim/sim-repaso-ajeno.ts` (anotado en T-472/T-573: "0 filas,
-- sin error").
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO ─────────────────────────────────────────────────────────
-- Ninguna de las dos tiene columna de identificador directo (correo, nombre, teléfono, IP, pago):
-- solo `user_id` (uuid) + actividad/metadata de test (respuestas, tiempos, jsonb de analítica).
-- Mismo perfil de riesgo que `questions`/`topic_scope`, ya concedidas sin política adicional
-- porque no tienen RLS activo; aquí sí lo tienen, así que hace falta la política explícita.
--
-- **Deliberadamente NO se toca ninguna otra de las ~70 tablas con RLS activo y cero políticas.**
-- La inmensa mayoría son operativas o con PII (bloquearlas es el comportamiento correcto — RLS
-- deniega por defecto sin política) y no las pide ningún `DEBE_LEER` ni ninguna herramienta real
-- de la flota. Añadir política a lo que no hace falta sería exponer sin necesidad.
--
-- SELECT solamente, y solo `vence_lector` (NO `vence_coordinacion`: ese rol se queda en sus 4
-- tablas de coordinación — no necesita actividad de tests para repartir trabajo).
--
-- Idempotente.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['test_questions', 'tests'] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS flota_lector_lee ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY flota_lector_lee ON public.%I FOR SELECT TO vence_lector USING (true)', t);
  END LOOP;
END $$;

-- El supuesto sobre el que descansa esto: `vence_lector` ya tiene el GRANT de tabla (de
-- `20260805_rol_lector_flota.sql`) y ninguna de las dos tablas fue REVOCADA ahí. Si algún día se
-- revoca, la política de aquí queda inocua sola (sin GRANT no hay nada que la política permita).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.role_table_grants
   WHERE grantee = 'vence_lector'
     AND table_schema = 'public'
     AND table_name IN ('test_questions', 'tests')
     AND privilege_type = 'SELECT';
  IF n <> 2 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en test_questions y tests (tiene %): la política de esta migración no serviría de nada sin él (T-573)', n;
  END IF;
END $$;
