-- =====================================================
-- Tabla: oposiciones
-- Almacena información de convocatorias de oposiciones
-- Centraliza fechas, plazas y datos de cada oposición
-- =====================================================

-- Crear tabla
CREATE TABLE IF NOT EXISTS oposiciones (
  id TEXT PRIMARY KEY,                      -- 'auxiliar-administrativo-estado', 'administrativo-estado'
  name TEXT NOT NULL,                       -- 'Auxiliar Administrativo del Estado'
  short_name TEXT,                          -- 'Auxiliar C2'
  grupo TEXT,                               -- 'C2', 'C1'
  subgrupo TEXT,                            -- 'C2', 'C1'

  -- Fechas importantes
  exam_date DATE,                           -- Fecha del examen
  inscription_start DATE,                   -- Inicio plazo inscripción
  inscription_deadline DATE,                -- Fin plazo inscripción
  boe_publication_date DATE,                -- Fecha publicación BOE
  boe_reference TEXT,                       -- 'BOE-A-2025-26262'

  -- Plazas
  plazas_libres INT,                        -- Plazas acceso libre
  plazas_promocion_interna INT,             -- Plazas promoción interna
  plazas_discapacidad INT,                  -- Plazas reservadas discapacidad

  -- Temario
  temas_count INT,                          -- Número total de temas
  bloques_count INT,                        -- Número de bloques

  -- Requisitos
  titulo_requerido TEXT,                    -- 'Graduado ESO', 'Bachillerato'
  edad_minima INT DEFAULT 16,

  -- Sueldo estimado
  salario_min INT,                          -- Salario mínimo anual
  salario_max INT,                          -- Salario máximo anual

  -- URLs
  url_convocatoria TEXT,                    -- URL al BOE
  url_temario TEXT,                         -- URL interna al temario

  -- Estado
  is_active BOOLEAN DEFAULT true,           -- Si está disponible en la plataforma
  is_convocatoria_activa BOOLEAN DEFAULT false, -- Si hay convocatoria abierta

  -- Metadata
  description TEXT,                         -- Descripción larga
  novedades_temario TEXT[],                 -- Array de novedades del temario

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_oposiciones_active ON oposiciones(is_active);
CREATE INDEX IF NOT EXISTS idx_oposiciones_exam_date ON oposiciones(exam_date);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_oposiciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_oposiciones_updated_at ON oposiciones;
CREATE TRIGGER trigger_oposiciones_updated_at
  BEFORE UPDATE ON oposiciones
  FOR EACH ROW
  EXECUTE FUNCTION update_oposiciones_updated_at();

-- =====================================================
-- Insertar datos de las oposiciones actuales
-- =====================================================

INSERT INTO oposiciones (
  id,
  name,
  short_name,
  grupo,
  subgrupo,
  exam_date,
  inscription_start,
  inscription_deadline,
  boe_publication_date,
  boe_reference,
  plazas_libres,
  plazas_promocion_interna,
  plazas_discapacidad,
  temas_count,
  bloques_count,
  titulo_requerido,
  salario_min,
  salario_max,
  url_temario,
  is_active,
  is_convocatoria_activa,
  description,
  novedades_temario
) VALUES
(
  'auxiliar-administrativo-estado',
  'Auxiliar Administrativo del Estado',
  'Auxiliar C2',
  'C',
  'C2',
  '2026-05-23',
  '2025-12-23',
  '2026-01-22',
  '2025-12-22',
  'BOE-A-2025-26261',
  1700,
  720,
  170,
  28,
  2,
  'Graduado en ESO o equivalente',
  18000,
  24000,
  '/auxiliar-administrativo-estado/temario',
  true,
  true,
  'Oposición para trabajar en la Administración General del Estado como Auxiliar Administrativo. Grupo C2.',
  ARRAY['Inclusión de Copilot en Windows 11', 'Actualización Office 365']
),
(
  'administrativo-estado',
  'Administrativo del Estado',
  'Administrativo C1',
  'C',
  'C1',
  '2026-05-23',
  '2025-12-23',
  '2026-01-22',
  '2025-12-22',
  'BOE-A-2025-26262',
  2512,
  6178,
  230,
  45,
  6,
  'Bachillerato o Técnico (FP Grado Medio)',
  22000,
  30000,
  '/administrativo-estado/temario',
  true,
  true,
  'Oposición de nivel superior para la Administración General del Estado. Grupo C1.',
  ARRAY['Políticas LGTBI (Tema 22)', 'Copilot de Windows (Tema 39)']
)
ON CONFLICT (id) DO UPDATE SET
  exam_date = EXCLUDED.exam_date,
  inscription_deadline = EXCLUDED.inscription_deadline,
  plazas_libres = EXCLUDED.plazas_libres,
  plazas_promocion_interna = EXCLUDED.plazas_promocion_interna,
  is_convocatoria_activa = EXCLUDED.is_convocatoria_activa,
  updated_at = NOW();

-- =====================================================
-- Permisos RLS
-- =====================================================

ALTER TABLE oposiciones ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer oposiciones activas
CREATE POLICY "Oposiciones visibles para todos"
  ON oposiciones FOR SELECT
  USING (is_active = true);

-- Solo admins pueden modificar (requiere rol admin)
CREATE POLICY "Solo admins pueden modificar oposiciones"
  ON oposiciones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'super_admin')
    )
  );

-- =====================================================
-- Función RPC para obtener fecha de examen
-- =====================================================

CREATE OR REPLACE FUNCTION get_exam_date(p_oposicion_id TEXT)
RETURNS DATE
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT exam_date
  FROM oposiciones
  WHERE id = p_oposicion_id
  AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_exam_date(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_exam_date(TEXT) TO anon;

-- =====================================================
-- Función RPC para obtener info completa de oposición
-- =====================================================

CREATE OR REPLACE FUNCTION get_oposicion_info(p_oposicion_id TEXT)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'id', id,
    'name', name,
    'short_name', short_name,
    'grupo', grupo,
    'exam_date', exam_date,
    'inscription_deadline', inscription_deadline,
    'days_to_exam', CASE
      WHEN exam_date IS NOT NULL
      THEN (exam_date - CURRENT_DATE)::INT
      ELSE NULL
    END,
    'days_to_inscription', CASE
      WHEN inscription_deadline IS NOT NULL
      THEN (inscription_deadline - CURRENT_DATE)::INT
      ELSE NULL
    END,
    'plazas_libres', plazas_libres,
    'plazas_promocion_interna', plazas_promocion_interna,
    'temas_count', temas_count,
    'titulo_requerido', titulo_requerido,
    'is_convocatoria_activa', is_convocatoria_activa,
    'novedades_temario', novedades_temario
  )
  FROM oposiciones
  WHERE id = p_oposicion_id
  AND is_active = true;
$$;

GRANT EXECUTE ON FUNCTION get_oposicion_info(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_oposicion_info(TEXT) TO anon;

-- Comentario de documentación
COMMENT ON TABLE oposiciones IS
'Tabla centralizada con información de todas las oposiciones disponibles.
Incluye fechas de examen, plazas, requisitos y estado de convocatoria.
Usar get_oposicion_info(id) para obtener datos completos.';
