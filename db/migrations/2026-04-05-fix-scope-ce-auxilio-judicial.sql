-- Migración: Ajustar scope CE Auxilio Judicial T1 a arts específicos
-- Fix: antes asignaba "toda la CE" (186 arts) pero epigrafe es específico
-- Creado: 2026-04-05

-- Epigrafe oficial Tema 1 Auxilio Judicial:
-- "La Constitución española de 1978: Estructura y contenido. Las atribuciones
--  de la Corona. Las Cortes Generales: Composición, atribuciones y funcionamiento.
--  La elaboración de las leyes. El Tribunal Constitucional. Composición y funciones."
--
-- Arts precisos según el epigrafe:
-- - arts 1-9:     Título Preliminar (Estructura y contenido)
-- - arts 56-65:   Título II (Corona)
-- - arts 66-80:   Título III Cap.I (Cortes Generales: composición, atribuciones)
-- - arts 81-92:   Título III Cap.II (Elaboración de las leyes)
-- - arts 159-165: Título IX (Tribunal Constitucional)
-- Total: 53 arts específicos (no los 186 de toda la CE)

UPDATE topic_scope
SET article_numbers = ARRAY[
  '1','2','3','4','5','6','7','8','9',
  '56','57','58','59','60','61','62','63','64','65',
  '66','67','68','69','70','71','72','73','74','75','76','77','78','79','80',
  '81','82','83','84','85','86','87','88','89','90','91','92',
  '159','160','161','162','163','164','165'
]
WHERE topic_id = (SELECT id FROM topics WHERE position_type = 'auxilio_judicial' AND topic_number = 1)
  AND law_id = (SELECT id FROM laws WHERE short_name = 'CE');
