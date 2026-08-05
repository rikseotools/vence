-- T-486 / T-574 — políticas RLS para que la flota pueda LEER y RECLAMAR impugnaciones.
--
-- ── EL BLOQUEO, DIAGNOSTICADO POR LOS PROPIOS TRABAJADORES ──────────────────────────────────
-- Se concedieron los permisos de tabla (SELECT, y UPDATE solo de `claimed_by`/`claimed_at`) y los
-- trabajadores seguían sin ver nada. La causa: **RLS activo con CERO políticas** en las dos tablas.
-- Sin una sola política, RLS deniega TODO a cualquiera que no sea el dueño o un superusuario — y
-- por eso la aplicación nunca lo notó: se conecta con `venceadmin`, que lo salta.
--
-- Un GRANT sin política es un permiso que no existe. Los dos hacen falta, y ninguno de los dos se
-- ve desde el otro: por eso se afirma aquí abajo, no se da por hecho.
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO ─────────────────────────────────────────────────────────
-- La política deja VER las filas y ACTUALIZARLAS. Lo que impide tocar el veredicto no es la
-- política: es el GRANT POR COLUMNAS de la migración anterior, que solo concede `claimed_by` y
-- `claimed_at`. Los dos mecanismos juntos dan exactamente «puede coger sitio en la cola y leer el
-- caso; no puede resolverlo». Y ENVIAR sigue siendo de una persona (`lib/sessions/aprobacion.cjs`).
--
-- `vence_lector` recibe solo lectura: es la credencial con la que se lee el contenido del caso.
--
-- Idempotente.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['question_disputes', 'psychometric_question_disputes'] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS flota_coordinacion_lee ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY flota_coordinacion_lee ON public.%I FOR SELECT TO vence_coordinacion, vence_lector USING (true)', t);

    EXECUTE format(
      'DROP POLICY IF EXISTS flota_coordinacion_reclama ON public.%I', t);
    -- Solo `vence_coordinacion`, y solo puede escribir las columnas que su GRANT le concede.
    EXECUTE format(
      'CREATE POLICY flota_coordinacion_reclama ON public.%I FOR UPDATE TO vence_coordinacion USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- El supuesto sobre el que descansa la seguridad de esto NO es la política: es el grant por
-- columnas. Si alguien concediera la tabla entera, la política dejaría de ser inocua.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.column_privileges
   WHERE grantee = 'vence_coordinacion'
     AND table_name IN ('question_disputes', 'psychometric_question_disputes')
     AND privilege_type = 'UPDATE'
     AND column_name NOT IN ('claimed_by', 'claimed_at');
  IF n > 0 THEN
    RAISE EXCEPTION 'vence_coordinacion puede escribir % columna(s) fuera de claimed_by/claimed_at: con la política RLS puesta, eso le permitiría resolver impugnaciones (T-486)', n;
  END IF;
END $$;
