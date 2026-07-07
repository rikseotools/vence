-- Catálogo — lote DOCENTES (nivel `catalogada`, misión "todas las oposiciones de España")
--
-- Vertical casi vacío (2 filas). Los competidores de docencia (oposicionesdocencia,
-- reverte) destaparon la demanda. Se catalogan las especialidades OFICIALES (RD
-- 276/2007) como cuerpo nacional; la convocatoria concreta es por CCAA (se refina
-- luego). coverage_level='catalogada', is_active=false (radar, no vendible aún).
-- Idempotente (dedup por slug). Runbook: docs/maintenance/crear-nueva-oposicion.md §0

INSERT INTO public.oposiciones (nombre, slug, tipo_acceso, administracion, categoria, subgrupo, coverage_level, estado_proceso, is_active)
SELECT v.nombre, v.slug, 'libre', 'Autonómica (Educación)', v.cat, v.cat, 'catalogada', 'sin_oep', false
FROM (VALUES
  -- Cuerpo de Maestros (Subgrupo A2) — 8 especialidades RD 276/2007
  ('Cuerpo de Maestros - Educación Infantil',        'maestros-educacion-infantil',        'A2'),
  ('Cuerpo de Maestros - Educación Primaria',        'maestros-educacion-primaria',        'A2'),
  ('Cuerpo de Maestros - Lengua Extranjera: Inglés', 'maestros-ingles',                    'A2'),
  ('Cuerpo de Maestros - Lengua Extranjera: Francés','maestros-frances',                   'A2'),
  ('Cuerpo de Maestros - Educación Física',          'maestros-educacion-fisica',          'A2'),
  ('Cuerpo de Maestros - Música',                    'maestros-musica',                    'A2'),
  ('Cuerpo de Maestros - Pedagogía Terapéutica',     'maestros-pedagogia-terapeutica',     'A2'),
  ('Cuerpo de Maestros - Audición y Lenguaje',       'maestros-audicion-y-lenguaje',       'A2'),
  -- Profesores de Enseñanza Secundaria (Subgrupo A1) — especialidades destapadas por competidores
  ('Profesores de Secundaria - Biología y Geología',           'secundaria-biologia-y-geologia',           'A1'),
  ('Profesores de Secundaria - Física y Química',              'secundaria-fisica-y-quimica',              'A1'),
  ('Profesores de Secundaria - Economía',                     'secundaria-economia',                      'A1'),
  ('Profesores de Secundaria - Geografía e Historia',         'secundaria-geografia-e-historia',          'A1'),
  ('Profesores de Secundaria - Lengua Castellana y Literatura','secundaria-lengua-castellana-y-literatura','A1'),
  ('Profesores de Secundaria - Matemáticas',                  'secundaria-matematicas',                   'A1'),
  ('Profesores de Secundaria - Tecnología',                   'secundaria-tecnologia',                    'A1'),
  ('Profesores de Secundaria - Latín',                        'secundaria-latin',                         'A1')
) AS v(nombre, slug, cat)
WHERE NOT EXISTS (SELECT 1 FROM public.oposiciones o WHERE o.slug = v.slug);
