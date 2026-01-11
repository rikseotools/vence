-- ============================================
-- TABLA: convocatorias_boe
-- Sistema de detección y almacenamiento de convocatorias del BOE
-- ============================================

CREATE TABLE IF NOT EXISTS convocatorias_boe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificación BOE
  boe_id TEXT UNIQUE NOT NULL,           -- "BOE-A-2026-577"
  boe_fecha DATE NOT NULL,               -- Fecha publicación BOE
  boe_url_pdf TEXT,                      -- URL al PDF
  boe_url_html TEXT,                     -- URL al HTML
  boe_url_xml TEXT,                      -- URL al XML

  -- Datos extraídos del sumario
  titulo TEXT NOT NULL,                  -- Título completo
  titulo_limpio TEXT,                    -- Título sin "Resolución de..."
  departamento_codigo TEXT,              -- "5140"
  departamento_nombre TEXT,              -- "MINISTERIO DE HACIENDA"
  epigrafe TEXT,                         -- "Personal funcionario"

  -- Clasificación (parseada del título/contenido)
  tipo TEXT,                             -- 'convocatoria'|'admitidos'|'tribunal'|'resultado'|'correccion'|'otro'
  categoria TEXT,                        -- 'A1'|'A2'|'C1'|'C2'|null
  cuerpo TEXT,                           -- "Cuerpo General Auxiliar"
  acceso TEXT,                           -- 'libre'|'promocion_interna'|'mixto'|'discapacidad'

  -- Datos numéricos (extraídos si están disponibles)
  num_plazas INTEGER,                    -- Número de plazas total
  num_plazas_libre INTEGER,              -- Plazas acceso libre
  num_plazas_pi INTEGER,                 -- Plazas promoción interna
  num_plazas_discapacidad INTEGER,       -- Plazas discapacidad

  -- Fechas importantes
  fecha_disposicion DATE,                -- Fecha de la resolución
  fecha_limite_inscripcion DATE,         -- Fecha límite para inscribirse
  fecha_examen DATE,                     -- Fecha de examen si se menciona

  -- Relaciones
  oposicion_relacionada TEXT,            -- 'auxiliar-administrativo-estado', etc.
  convocatoria_origen_id UUID REFERENCES convocatorias_boe(id), -- Si es corrección/admitidos de otra

  -- Contenido (desde XML)
  resumen TEXT,                          -- Resumen generado
  contenido_texto TEXT,                  -- Texto completo descargado del XML
  rango TEXT,                            -- "Resolución", "Orden", etc.
  pagina_inicial INTEGER,
  pagina_final INTEGER,

  -- Datos extraídos del texto
  plazo_inscripcion_dias INTEGER,        -- Días hábiles para inscribirse
  titulacion_requerida TEXT,             -- "Título de Bachiller", etc.
  tiene_temario BOOLEAN DEFAULT FALSE,   -- Si menciona programa/temario
  url_bases TEXT,                        -- URL a bases específicas si existe

  -- Metadatos
  relevancia_score INTEGER DEFAULT 0,    -- 0-100, para ordenar
  destacada BOOLEAN DEFAULT FALSE,       -- Mostrar en home
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT convocatorias_boe_tipo_check
    CHECK (tipo IS NULL OR tipo IN ('convocatoria', 'admitidos', 'tribunal', 'resultado', 'correccion', 'otro')),
  CONSTRAINT convocatorias_boe_categoria_check
    CHECK (categoria IS NULL OR categoria IN ('A1', 'A2', 'B', 'C1', 'C2')),
  CONSTRAINT convocatorias_boe_acceso_check
    CHECK (acceso IS NULL OR acceso IN ('libre', 'promocion_interna', 'mixto', 'discapacidad'))
);

-- ============================================
-- ÍNDICES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_fecha
  ON convocatorias_boe(boe_fecha DESC);

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_tipo
  ON convocatorias_boe(tipo)
  WHERE tipo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_categoria
  ON convocatorias_boe(categoria)
  WHERE categoria IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_departamento
  ON convocatorias_boe(departamento_codigo);

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_oposicion
  ON convocatorias_boe(oposicion_relacionada)
  WHERE oposicion_relacionada IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_relevancia
  ON convocatorias_boe(relevancia_score DESC);

CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_active
  ON convocatorias_boe(is_active)
  WHERE is_active = TRUE;

-- Índice para búsqueda full-text
CREATE INDEX IF NOT EXISTS idx_convocatorias_boe_titulo_fts
  ON convocatorias_boe USING gin(to_tsvector('spanish', titulo));

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE convocatorias_boe ENABLE ROW LEVEL SECURITY;

-- Todos pueden leer convocatorias activas
CREATE POLICY "Public can read active convocatorias"
  ON convocatorias_boe
  FOR SELECT
  TO public
  USING (is_active = TRUE);

-- Solo service role puede insertar/actualizar
CREATE POLICY "Service can insert convocatorias"
  ON convocatorias_boe
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service can update convocatorias"
  ON convocatorias_boe
  FOR UPDATE
  TO service_role
  USING (TRUE);

-- ============================================
-- TRIGGER PARA updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_convocatorias_boe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_convocatorias_boe_updated_at
  BEFORE UPDATE ON convocatorias_boe
  FOR EACH ROW
  EXECUTE FUNCTION update_convocatorias_boe_updated_at();

-- ============================================
-- COMENTARIOS
-- ============================================

COMMENT ON TABLE convocatorias_boe IS 'Convocatorias de oposiciones extraídas del BOE (sección II-B)';
COMMENT ON COLUMN convocatorias_boe.boe_id IS 'Identificador único del BOE, ej: BOE-A-2026-577';
COMMENT ON COLUMN convocatorias_boe.tipo IS 'Tipo de publicación: convocatoria, admitidos, tribunal, resultado, correccion, otro';
COMMENT ON COLUMN convocatorias_boe.categoria IS 'Grupo/Subgrupo: A1, A2, B, C1, C2';
COMMENT ON COLUMN convocatorias_boe.oposicion_relacionada IS 'Slug de oposición si aplica: auxiliar-administrativo-estado, administrativo-estado, gestion-procesal';
COMMENT ON COLUMN convocatorias_boe.relevancia_score IS 'Puntuación 0-100 para ordenar por relevancia';
