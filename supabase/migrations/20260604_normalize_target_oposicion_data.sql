-- 20260604_normalize_target_oposicion_data.sql
-- Fase 8 / arreglo chapuza: normaliza user_profiles.target_oposicion_data.
--
-- BUG histórico: los 2 write-paths cliente (OposicionChangeModal,
-- OposicionContext.changeOposicion) escribían `JSON.stringify(obj)` en una
-- columna JSONB → quedaba DOBLE-CODIFICADO como string JSON
-- ("{\"id\":...}") en vez de objeto. ~1298 filas afectadas (medido 04/06).
--
-- Este fix re-parsea esos strings a objeto JSONB. `#>> '{}'` extrae el jsonb
-- como texto (el JSON interno) y ::jsonb lo vuelve a parsear → objeto.
--
-- La unificación de SHAPE (hay 4 variantes de keys) NO se hace aquí: se
-- garantiza hacia delante con el endpoint único de cambio de objetivo (shape
-- canónico). Esto solo arregla la corrupción de tipo (string→object).
--
-- Idempotente (tras correr, ya no hay strings → 0 filas afectadas). Reversible
-- no aplica (es un fix de datos corruptos).

UPDATE public.user_profiles
SET target_oposicion_data = (target_oposicion_data #>> '{}')::jsonb
WHERE jsonb_typeof(target_oposicion_data) = 'string';
