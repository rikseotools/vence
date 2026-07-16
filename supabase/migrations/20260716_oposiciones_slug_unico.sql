-- `oposiciones.slug` es la IDENTIDAD PÚBLICA (la URL: /<slug>, /<slug>/temario, /<slug>/test) y hasta
-- hoy no tenía NI índice NI unicidad: la tabla solo tenía PRIMARY KEY (id).
--
-- Encontrado el 16/07/2026 al intentar catalogar una oposición nueva: `ON CONFLICT (slug)` falló con
-- "there is no unique or exclusion constraint matching the ON CONFLICT specification".
--
-- DOS AGUJEROS EN UNO:
--  1. Sin UNIQUE → nada impide dos filas con el mismo slug. Hoy hay 0 duplicados por DISCIPLINA, no
--     por diseño; el día que un alta se re-ejecute o dos sesiones creen la misma oposición a la vez,
--     el enrutado (y el catálogo, y las landings) se rompen de una forma difícil de diagnosticar.
--  2. Sin ÍNDICE → cada búsqueda por slug es un seq scan. Y la app busca por slug en TODAS las
--     landings, el catálogo, el selector de oposición y los tests.
--
-- El índice único resuelve las dos. Verificado antes de aplicar: 0 slugs duplicados, así que se
-- construye sin conflicto. (UNIQUE permite varios NULL, no hay riesgo con filas sin slug.)

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_oposiciones_slug ON public.oposiciones(slug);

COMMENT ON INDEX public.uq_oposiciones_slug IS
  'slug = identidad pública (URL). Único: dos oposiciones con el mismo slug romperían el enrutado. Además da el índice que faltaba: la app busca por slug en todas las landings.';

COMMIT;
