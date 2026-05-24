-- 2026-05-24-tema-number-warning-comments.sql
--
-- COMMENT ON COLUMN persistente en BD advirtiendo del bug histórico de
-- tema_number cross-oposición. El comentario lo lee cualquier DBA o herramienta
-- (DBeaver, pgAdmin, drizzle-kit introspect) y queda como source of truth.
--
-- Contexto:
--   tests.tema_number y test_questions.tema_number son ints sin contexto de
--   oposición. Distintas oposiciones usan el mismo rango (B1: 1-N, B2: 101+)
--   para sus respectivos temas pero con CONTENIDOS DISTINTOS:
--     T101 auxiliar_administrativo_estado = "Atención al ciudadano"
--     T101 administrativo_seguridad_social = "La SS en la CE. TRLGSS"
--   Cualquier query que GROUP BY tema_number sin filtrar por oposición mezcla
--   B2 entre oposiciones y produce dashboards engañosos (caso María Lorenzo,
--   feedback 0f4734c0, 24/05/2026).
--
-- Solución persistida: tests.position_type (columna añadida 2026-05-24).
-- Queries de cómputo por tema deben joinear contra tests.position_type
-- antes de agrupar.

BEGIN;

COMMENT ON COLUMN public.test_questions.tema_number IS
  'NÚMERO DE TEMA EN EL CONTEXTO DE LA OPOSICIÓN DEL TEST. '
  'Se resuelve dinámicamente al INSERT usando la oposición activa del user en ese momento. '
  'NO es identificador global: distintas oposiciones reutilizan los mismos topic_number con '
  'contenidos distintos (p.ej. T101 auxiliar_administrativo_estado = "Atención al ciudadano" '
  'vs T101 administrativo_seguridad_social = "La SS en la CE"). '
  'Para cómputos por oposición usa SIEMPRE tests.position_type como filtro previo. '
  'Ver lib/api/topic-progress/ para el patrón canónico.';

COMMENT ON COLUMN public.tests.tema_number IS
  'Número de tema sobre el que va el test, en el contexto de tests.position_type. '
  'Igual que test_questions.tema_number: NO es identificador global. '
  'Para mostrar el título correcto del tema (UI), siempre joinear topics ON '
  'topic_number = tests.tema_number AND position_type = tests.position_type.';

COMMIT;
