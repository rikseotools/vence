-- T-638 — `vence_lector` puede leer `question_lifecycle_history`: RLS activo, cero políticas.
--
-- ── EL MISMO BLOQUEO QUE `test_questions`/`tests` YA TUVO (T-573), OTRA VEZ ────────────────
-- `20260805_rol_lector_flota.sql` concedió `GRANT SELECT ON ALL TABLES IN SCHEMA public TO
-- vence_lector` — un permiso de TABLA. Pero `question_lifecycle_history` tiene RLS activo
-- (`relrowsecurity = true`) sin una sola política, y con RLS activo el GRANT de tabla no basta:
-- el motor filtra en silencio y devuelve CERO filas siempre, sea cual sea el contenido real —
-- no lanza error, así que un canario que solo mira "¿lanzó?" lo da por bueno (falso verde, ya
-- diagnosticado en T-574 para `question_disputes` y reproducido en T-573 para `test_questions`/
-- `tests`. Aquí es la tercera vez: `lib/db/rlsSelectBlocked.cjs` + `pg_class.relrowsecurity`
-- cruzado con `pg_policies` lo confirma otra vez).
--
-- Encontrado trabajando [T-598] (07/08): al intentar corroborar que una transición de lifecycle
-- había pasado de verdad, `SELECT count(*) FROM question_lifecycle_history` devolvía 0 —
-- para CUALQUIER filtro, siempre. No es que la tabla esté vacía: es la fuente única de verdad
-- del audit trail de lifecycle (CLAUDE.md) y la citan al menos 11 fichas de
-- `docs/roadmap/tareas-pendientes.md` como el sitio donde verificar transiciones. Ningún worker
-- de la flota podía comprobarlo — solo fiarse de la prosa de otra sesión.
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO ─────────────────────────────────────────────────────────
-- Columnas: id, question_id, from_state, to_state, reason_code, changed_at, changed_by,
-- ai_verification_id, notes. Ningún identificador directo de persona (correo, nombre, teléfono,
-- IP, pago) — `changed_by` es el autor del cambio como identificador de sesión/sistema, no un
-- dato personal. Mismo perfil de riesgo que `test_questions`/`tests`, concedidas en T-573.
--
-- **Deliberadamente NO se toca ninguna otra de las ~70 tablas con RLS activo y cero políticas.**
-- La inmensa mayoría son operativas o con PII (bloquearlas es el comportamiento correcto — RLS
-- deniega por defecto sin política). Añadir política a lo que no hace falta sería exponer sin
-- necesidad.
--
-- SELECT solamente, y solo `vence_lector` (NO `vence_coordinacion`: ese rol se queda en sus 4
-- tablas de coordinación).
--
-- Idempotente.

DROP POLICY IF EXISTS flota_lector_lee ON public.question_lifecycle_history;
CREATE POLICY flota_lector_lee ON public.question_lifecycle_history
  FOR SELECT TO vence_lector USING (true);

-- El supuesto sobre el que descansa esto: `vence_lector` ya tiene el GRANT de tabla (de
-- `20260805_rol_lector_flota.sql`) y la tabla no fue REVOCADA ahí. Si algún día se revoca, la
-- política de aquí queda inocua sola (sin GRANT no hay nada que la política permita).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.role_table_grants
   WHERE grantee = 'vence_lector'
     AND table_schema = 'public'
     AND table_name = 'question_lifecycle_history'
     AND privilege_type = 'SELECT';
  IF n <> 1 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en question_lifecycle_history (tiene %): la política de esta migración no serviría de nada sin él (T-638)', n;
  END IF;
END $$;
