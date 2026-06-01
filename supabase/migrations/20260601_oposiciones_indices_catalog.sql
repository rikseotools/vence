-- Sprint B: índices BD para queries del catálogo de oposiciones.
--
-- El endpoint /api/oposiciones/catalog filtra por (coverage_level, categoria,
-- administracion) y ordena por demand_score DESC. Sin estos índices, una
-- query sobre 500+ filas haría seq scan. Con ellos, p99 < 50ms.
--
-- CREATE INDEX CONCURRENTLY: no bloquea writes. Tarda más pero seguro.
-- Las CONCURRENTLY no pueden ir dentro de una transacción → ejecutar
-- una a una.

-- 1) Compuesto principal para el catálogo público
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oposiciones_catalog_filter
  ON public.oposiciones (coverage_level, categoria, administracion);

-- 2) Para ordenar por demanda (cron auto-promote actualiza demand_score)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oposiciones_demand_score
  ON public.oposiciones (demand_score DESC NULLS LAST);

-- 3) Slug ya tiene UNIQUE constraint → tiene su índice. Verificar y crear si no.
-- (En BD verificamos antes que no exista.)

-- 4) Para queries por fetcher_type (cron de detección filtra por este campo
-- para invocar la Lambda headless solo donde toca).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oposiciones_fetcher_type
  ON public.oposiciones (fetcher_type)
  WHERE fetcher_type != 'http';

-- ============================================================
-- ROLLBACK (descomentar si hace falta)
-- ============================================================
-- DROP INDEX CONCURRENTLY IF EXISTS idx_oposiciones_catalog_filter;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_oposiciones_demand_score;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_oposiciones_fetcher_type;
