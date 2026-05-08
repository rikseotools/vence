-- 2026-05-08-topics-descripcion-corta-not-null.sql
--
-- Hace NOT NULL la columna topics.descripcion_corta para garantizar
-- que cualquier topic que se inserte de aquí en adelante venga con su
-- descripción corta poblada (campo usado en el listado del temario).
--
-- Contexto: el test __tests__/integration/temarioEpigrafeIntegrity.test.ts
-- detectó 153 topics con descripcion_corta NULL en 5 oposiciones TCAE.
-- El manual `crear-nueva-oposicion.md` §5.1 ya marcaba el campo como
-- obligatorio pero la columna lo permitía nullable, por lo que la deuda
-- técnica se acumulaba silenciosamente. Esta migración cierra el hueco
-- a nivel de schema: imposible insertar un topic nuevo sin descripcion_corta.
--
-- Pre-requisito (ya completado 2026-05-08): poblar descripcion_corta de
-- los 153 topics afectados usando topics.title como fallback. Verificar
-- con: SELECT count(*) FROM topics WHERE descripcion_corta IS NULL OR descripcion_corta = '';
-- → debe ser 0 antes de aplicar este ALTER.

DO $$
BEGIN
  -- Verificación defensiva: si quedaran filas sin valor, abortar con mensaje claro.
  IF EXISTS (
    SELECT 1 FROM topics WHERE descripcion_corta IS NULL OR trim(descripcion_corta) = ''
  ) THEN
    RAISE EXCEPTION 'No se puede aplicar NOT NULL: aún hay topics sin descripcion_corta. Poblar primero.';
  END IF;
END $$;

ALTER TABLE topics
  ALTER COLUMN descripcion_corta SET NOT NULL;

-- Comentario explícito para futuros lectores del schema
COMMENT ON COLUMN topics.descripcion_corta IS
  'Descripción corta del tema usada en el listado del temario y cards. NOT NULL desde 2026-05-08. Si no se proporciona explícitamente al crear el topic, usar el title como fallback razonable.';
