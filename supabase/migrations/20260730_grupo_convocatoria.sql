-- Oposiciones que son LA MISMA con dos convocatorias vivas y temario distinto.
--
-- POR QUÉ (30/07/2026, caso Ana Isabel). Auxiliar Administrativo de la Comunidad de Madrid
-- tiene dos convocatorias abiertas a la vez con PROGRAMAS DISTINTOS: la Orden 264/2026
-- (examen 15/10/2026, Windows 10) y la Orden 1628/2026 (examen jun-2027, Windows 11). Se
-- sirven como dos oposiciones separadas ([T-063]) y en el selector se distinguen bien… pero
-- una vez dentro NADA te dice que existe la otra. Una usuaria estuvo estudiando el temario
-- que no le tocaba y se enteró de casualidad, preguntando otra cosa: «me he metido en la
-- convocatoria equivocada».
--
-- La relación va en la BD y no en un fichero de configuración a propósito: el catálogo de
-- oposiciones vive aquí, y una copia en código sería un silo que se desincroniza en cuanto
-- alguien añada la siguiente (y habrá siguientes: pasa en cada renovación de convocatoria
-- que cambia el temario).
--
-- `grupo_convocatoria` es un texto libre y estable que comparten las hermanas. NULL = la
-- oposición no tiene hermanas, que es el caso de casi todas.

ALTER TABLE oposiciones
  ADD COLUMN IF NOT EXISTS grupo_convocatoria text;

COMMENT ON COLUMN oposiciones.grupo_convocatoria IS
  'Oposiciones que son la MISMA con convocatorias vivas y temario distinto comparten este valor. NULL = sin hermanas. Se usa para avisar al usuario de que compruebe cuál tiene seleccionada (caso Madrid 2026/2027).';

-- Solo indexa las que tienen grupo: son cuatro gatos frente al catálogo entero.
CREATE INDEX IF NOT EXISTS idx_oposiciones_grupo_convocatoria
  ON oposiciones (grupo_convocatoria)
  WHERE grupo_convocatoria IS NOT NULL;

-- El caso que la motiva.
UPDATE oposiciones SET grupo_convocatoria = 'auxiliar-administrativo-madrid'
 WHERE slug IN ('auxiliar-administrativo-madrid', 'auxiliar-administrativo-madrid-2027');
