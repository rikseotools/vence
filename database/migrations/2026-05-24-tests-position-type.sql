-- 2026-05-24-tests-position-type.sql
--
-- Añade tests.position_type para fijar la oposición de cada test en el
-- momento del INSERT. Esto elimina la ambigüedad de tests.tema_number,
-- que es un int sin contexto (las distintas oposiciones comparten el
-- rango 101-112 para sus Bloques II pero con temas completamente
-- distintos: T101 AAE = "Atención al ciudadano" vs T101 SS = "SS en la CE").
--
-- Bug que motiva esta migración (caso María Lorenzo, 24/05/2026):
-- al cambiar de target_oposicion, su /mis-estadisticas mostraba como
-- "trabajados" T102-T112 de SS aunque las preguntas reales eran del B2
-- de AAE (Word, Excel, etc.), porque GROUP BY tema_number agrupaba
-- cross-oposición. Con esta columna se puede filtrar por la oposición
-- real del test sin depender de regex sobre test_url ni del target
-- actual del user.
--
-- Estrategia:
--   1) Esta migración solo añade la columna NULLable + índice parcial.
--      No bloquea ni rompe nada existente.
--   2) Un script de backfill posterior rellenará la columna para tests
--      existentes derivando el primer segmento de test_url contra
--      ALL_OPOSICION_SLUGS conocidos.
--   3) createDetailedTestSession() en utils/testSession.ts añade el valor
--      al INSERT para nuevos tests.
--   4) Las queries (getThemePerformance, getRecentTests, weak-articles)
--      prefieren position_type cuando exista; fallback a derivación o
--      legacy si NULL (tests globales /test/rapido, /leyes, o legacy
--      pre-backfill).
--
-- Una vez backfilled + el code-path nuevo en producción y validado, se
-- puede valorar añadir NOT NULL constraint o trigger que rechace inserts
-- sin position_type cuando test_url empieza por slug conocido.

BEGIN;

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS position_type text NULL;

-- Índice parcial: tests del user en una oposición concreta, ordenados por
-- fecha de completado. Cubre getRecentTests y agregaciones por (user, opo).
-- Parcial sobre is_completed=true porque los dashboards solo muestran tests
-- completados; reduce tamaño del índice ~30%.
CREATE INDEX IF NOT EXISTS idx_tests_user_position_completed
  ON public.tests(user_id, position_type, completed_at DESC)
  WHERE position_type IS NOT NULL AND is_completed = true;

COMMENT ON COLUMN public.tests.position_type IS
  'Oposición del test (formato position_type, underscore — p.ej. "auxiliar_administrativo_estado"). '
  'Capturado en createDetailedTestSession a partir de window.location.pathname. '
  'NULL para tests globales (/test/rapido, /leyes/...) y para tests legacy '
  'previos al backfill 2026-05-24-tests-position-type.sql. Las queries que '
  'necesiten filtrar por oposición DEBEN preferir esta columna sobre '
  'derivar de tests.tema_number (que es int sin contexto y colisiona entre '
  'B2 de oposiciones distintas).';

COMMIT;
