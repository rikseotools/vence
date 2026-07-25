-- 20260725_convocatorias_inscritos_presentados.sql
-- Apartado HISTÓRICO de convocatorias en las landings.
-- Añade los dos únicos números base de participación que aún no teníamos.
-- Los RATIOS (inscritos/plaza, presentados/plaza) y los PLAZOS (OEP→convocatoria→examen)
-- se calculan en render a partir de estas columnas + las fechas ya existentes; NO se almacenan.
-- Aditiva y nullable: no rompe ningún lector actual.
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS inscritos integer;
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS presentados integer;

COMMENT ON COLUMN convocatorias.inscritos IS
  'Nº de solicitudes/admitidos de esa convocatoria. SOLO fuente oficial (acta del tribunal / INAP / BOE de listas). NULL si no hay dato oficial verificado — NUNCA estimar.';
COMMENT ON COLUMN convocatorias.presentados IS
  'Nº de opositores presentados al primer ejercicio. SOLO fuente oficial. NULL si no hay dato oficial verificado — NUNCA estimar.';
