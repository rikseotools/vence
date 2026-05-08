-- 2026-05-08-psicotecnicas-clasificacion-palabras.sql
--
-- Crea sección "Clasificación de palabras" en categoría "Razonamiento verbal"
-- y migra a ella 36 preguntas que estaban mal seccionadas (estaban en
-- "Pruebas de clasificación" de "Capacidad administrativa").
--
-- Detectado por __tests__/integration/psychometricSectionIntegrity.test.ts:
-- "NO debe haber preguntas con section de otra categoría" — las 36
-- preguntas tenían category_id = Razonamiento verbal pero su section_id
-- apuntaba a una sección de Capacidad administrativa, generando un
-- mismatch de 36 en ambas categorías al sumar.
--
-- Análisis del contenido:
--   - Las 6 preguntas legítimas en "Pruebas de clasificación" (Cap. admin)
--     son codificación letras→binario (e.g. "d=0101, k=0110, l=1101...")
--     → SE QUEDAN ahí, son administrativas.
--   - Las 36 mal seccionadas son clasificación SEMÁNTICA de palabras
--     (e.g. "¿Qué palabra NO pertenece al grupo? Ostra, calamar, sepia,
--     merluza.") → SON razonamiento verbal y necesitan su sección propia.
--
-- Idempotente:
--   - El INSERT usa ON CONFLICT DO NOTHING (clave única (category_id, section_key)).
--   - El UPDATE usa la subconsulta para encontrar el id de la sección, así
--     que aplicar dos veces no afecta filas ya migradas.

DO $$
DECLARE
  v_verbal_cat_id UUID;
  v_admin_clasif_section_id UUID;
  v_new_section_id UUID;
  v_migrated INT;
BEGIN
  -- Resolver IDs por nombre (independiente del UUID concreto)
  SELECT id INTO v_verbal_cat_id
  FROM psychometric_categories
  WHERE display_name = 'Razonamiento verbal' LIMIT 1;

  SELECT s.id INTO v_admin_clasif_section_id
  FROM psychometric_sections s
  JOIN psychometric_categories c ON c.id = s.category_id
  WHERE c.display_name = 'Capacidad administrativa'
    AND s.section_key = 'clasificacion'
  LIMIT 1;

  -- Si la sección admin de "Pruebas de clasificación" no existe, no hay nada que migrar.
  IF v_admin_clasif_section_id IS NULL THEN
    RAISE NOTICE 'No existe sección "Pruebas de clasificación" en Capacidad administrativa. Nada que migrar.';
    RETURN;
  END IF;

  -- 1. Crear sección "Clasificación de palabras" en Razonamiento verbal
  INSERT INTO psychometric_sections (category_id, section_key, display_name, description, is_active, display_order)
  VALUES (
    v_verbal_cat_id,
    'clasificacion-palabras',
    'Clasificación de palabras',
    'Identificar la palabra que no pertenece a un grupo por significado o categoría semántica.',
    true,
    5
  )
  ON CONFLICT (category_id, section_key) DO NOTHING;

  -- Recuperar el id (puede ser nuevo o pre-existente si ya se aplicó antes)
  SELECT id INTO v_new_section_id
  FROM psychometric_sections
  WHERE category_id = v_verbal_cat_id AND section_key = 'clasificacion-palabras';

  -- 2. Migrar las 36 preguntas mal seccionadas
  UPDATE psychometric_questions
  SET section_id = v_new_section_id, updated_at = NOW()
  WHERE category_id = v_verbal_cat_id
    AND section_id = v_admin_clasif_section_id
    AND is_active = true;

  GET DIAGNOSTICS v_migrated = ROW_COUNT;
  RAISE NOTICE 'Migración completada: % preguntas movidas a "Clasificación de palabras".', v_migrated;
END $$;

-- Verificación post-migración
DO $$
DECLARE
  v_cross INT;
BEGIN
  SELECT COUNT(*) INTO v_cross
  FROM psychometric_questions q
  INNER JOIN psychometric_sections s ON q.section_id = s.id
  WHERE q.is_active = true AND s.category_id != q.category_id;

  IF v_cross > 0 THEN
    RAISE NOTICE 'AVISO: aún quedan % preguntas con section de otra categoría.', v_cross;
  ELSE
    RAISE NOTICE 'OK: 0 preguntas con section de otra categoría.';
  END IF;
END $$;
