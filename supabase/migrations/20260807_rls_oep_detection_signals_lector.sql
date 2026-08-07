-- T-108 / T-573 — `vence_lector` puede leer `oep_detection_signals` y `detection_sources`:
-- RLS activo, cero políticas. MISMO bloqueo, otra vez.
--
-- ── EL MISMO MECANISMO QUE `test_questions`/`tests` (T-573) Y `question_disputes` (T-574) ──
-- `20260805_rol_lector_flota.sql` concedió `GRANT SELECT ON ALL TABLES IN SCHEMA public TO
-- vence_lector` — un permiso de TABLA. Pero `oep_detection_signals` y `detection_sources`
-- tienen RLS activo (`relrowsecurity = true`) sin una sola política, y con RLS activo el GRANT
-- de tabla no basta: el motor filtra en silencio y devuelve CERO filas siempre, sea cual sea
-- el contenido real — no lanza error. Confirmado con el mismo detector que las otras dos veces
-- (`lib/db/rlsSelectBlocked.cjs` → `seleccionBloqueadaPorRls`, cruzando `pg_class.relrowsecurity`
-- con `pg_policies`): `true` para ambas, `false` para `oep`/`convocatoria_oep`/`radar_adapter_runs`
-- (sin RLS, se leen bien).
--
-- ── CÓMO SE DESTAPÓ (07/08, investigando [T-108]) ───────────────────────────────────────────
-- La ficha de T-108 arrastraba «no se ha podido demostrar que el camino vivo cree entidades:
-- 9 señales pending, 0 aplicadas desde el backfill del 29/07» — medido por una sesión anterior
-- leyendo `oep_detection_signals` con `VENCE_LECTOR_URL`. Repitiendo la medición hoy: la tabla
-- da **0 filas totales** (ni pending ni de ningún estado), mientras que `radar_adapter_runs`
-- —tabla SIN RLS, visible de verdad— muestra el radar corriendo HOY (última pasada 07/08 07:01
-- UTC, 316 runs históricos) y reportando `signals_new > 0` en varios adapters de la MISMA
-- mañana (`dogv`: 2, `bome`: 2, `pag-empleo`: 1). Owner de las 4 tablas: `venceadmin` — que por
-- ser dueño está EXENTO de RLS (Postgres, sin `FORCE ROW LEVEL SECURITY`, confirmado `false` en
-- las cuatro), así que la app en producción lee/escribe con normalidad. **Lo que estaba ciego
-- era la lectura de `vence_lector`, no el radar.**
--
-- Esto no demuestra por sí solo que `promoteSignalToConvocatoria` funcione en vivo (la pregunta
-- original de T-108) — sigue pendiente verificarlo una vez esta migración esté aplicada y se
-- pueda ver de verdad la cola de pendientes. Pero SÍ corrige la premisa: no hay evidencia de que
-- el radar haya dejado de generar señales, y la ausencia de OEP nuevas desde el 29/07 es al
-- menos en parte (quizás del todo) que nadie con acceso ha podido TRIAR lo que sí se genera.
--
-- ── EL ALCANCE, Y POR QUÉ ES SEGURO ─────────────────────────────────────────────────────────
-- Ninguna de las dos tiene columna de identificador directo (correo, nombre, teléfono, IP,
-- pago): `oep_detection_signals.reviewed_by` es `uuid` (igual que `user_id` en las tablas ya
-- concedidas), el resto son metadatos de la convocatoria detectada (año, plazas, BOC ref,
-- fechas, estado) y de la fuente (URL, boletín, región, palabras clave de búsqueda). Mismo
-- perfil de riesgo que `test_questions`/`tests`/`ai_verification_results`, ya concedidas.
--
-- Y hace falta de verdad: el runbook `docs/maintenance/oeps-convocatorias-seguimiento.md`
-- describe el flujo como "Claude en el bucle" — una sesión vuelca las señales pendientes,
-- las verifica contra fuente oficial y decide aplicar/descartar. Sin esta política, NINGUNA
-- sesión de la flota puede ver una sola señal pendiente para triar, con GRANT de tabla o sin él.
--
-- **Deliberadamente NO se toca ninguna otra de las tablas con RLS activo y cero políticas.**
-- Igual que en T-573/T-574: solo se añade política a lo que un flujo REAL y documentado
-- necesita leer.
--
-- SELECT solamente, y solo `vence_lector` (no `vence_coordinacion`: ese rol se queda en sus
-- 4 tablas de coordinación).
--
-- Idempotente.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['oep_detection_signals', 'detection_sources'] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS flota_lector_lee ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY flota_lector_lee ON public.%I FOR SELECT TO vence_lector USING (true)', t);
  END LOOP;
END $$;

-- El supuesto sobre el que descansa esto: `vence_lector` ya tiene el GRANT de tabla (de
-- `20260805_rol_lector_flota.sql`) y ninguna de las dos tablas fue REVOCADA ahí. Si algún día
-- se revoca, la política de aquí queda inocua sola (sin GRANT no hay nada que la política
-- permita).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.role_table_grants
   WHERE grantee = 'vence_lector'
     AND table_schema = 'public'
     AND table_name IN ('oep_detection_signals', 'detection_sources')
     AND privilege_type = 'SELECT';
  IF n <> 2 THEN
    RAISE EXCEPTION 'vence_lector no tiene GRANT SELECT en oep_detection_signals y detection_sources (tiene %): la política de esta migración no serviría de nada sin él (T-108)', n;
  END IF;
END $$;
