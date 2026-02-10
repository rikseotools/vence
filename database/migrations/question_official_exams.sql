-- Tabla de asociación para vincular preguntas a múltiples exámenes oficiales
-- Una misma pregunta puede aparecer en múltiples convocatorias/oposiciones
-- Fecha: 2026-02-02
--
-- IMPORTANTE: El campo "exam_date" en todas las tablas (questions, psychometric_questions,
-- y esta tabla) NO es la fecha en que se celebra el examen, sino la FECHA DE LA CONVOCATORIA
-- publicada en el BOE (ej: OEP 2020, OEP 2023). La fecha real del examen muchas veces es
-- desconocida o variable.

CREATE TABLE IF NOT EXISTS question_official_exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  psychometric_question_id UUID REFERENCES psychometric_questions(id) ON DELETE CASCADE,
  exam_date DATE NOT NULL, -- Fecha de la CONVOCATORIA en BOE (NO la fecha del examen)
  exam_source TEXT NOT NULL,
  exam_part TEXT, -- 'primera', 'segunda', etc.
  question_number INTEGER, -- número de pregunta en ese examen específico
  oposicion_type TEXT, -- 'auxiliar-administrativo-estado', 'tramitacion-procesal', etc.
  is_reserve BOOLEAN DEFAULT false,
  is_annulled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Una pregunta solo puede aparecer una vez por convocatoria+examen
  CONSTRAINT unique_question_per_exam
    UNIQUE NULLS NOT DISTINCT (question_id, exam_date, exam_source),
  CONSTRAINT unique_psychometric_per_exam
    UNIQUE NULLS NOT DISTINCT (psychometric_question_id, exam_date, exam_source),

  -- Al menos uno de los dos IDs debe estar presente
  CONSTRAINT question_or_psychometric_required
    CHECK (question_id IS NOT NULL OR psychometric_question_id IS NOT NULL)
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_qoe_exam_date ON question_official_exams(exam_date);
CREATE INDEX IF NOT EXISTS idx_qoe_exam_source ON question_official_exams(exam_source);
CREATE INDEX IF NOT EXISTS idx_qoe_question_id ON question_official_exams(question_id);
CREATE INDEX IF NOT EXISTS idx_qoe_psychometric_id ON question_official_exams(psychometric_question_id);
CREATE INDEX IF NOT EXISTS idx_qoe_oposicion ON question_official_exams(oposicion_type);

-- RLS
ALTER TABLE question_official_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for question_official_exams" ON question_official_exams;
CREATE POLICY "Enable read access for question_official_exams" ON question_official_exams
  FOR SELECT USING (true);

-- Migrar datos existentes (preguntas legislativas)
INSERT INTO question_official_exams (
  question_id, exam_date, exam_source, oposicion_type, is_reserve
)
SELECT
  id,
  exam_date,
  exam_source,
  CASE
    WHEN exam_source ILIKE '%Auxiliar Administrativo Estado%' THEN 'auxiliar-administrativo-estado'
    WHEN exam_source ILIKE '%Tramitación Procesal%' THEN 'tramitacion-procesal'
    WHEN exam_source ILIKE '%Auxilio Judicial%' THEN 'auxilio-judicial'
    ELSE 'unknown'
  END,
  exam_source ILIKE '%Reserva%'
FROM questions
WHERE is_official_exam = true
  AND exam_date IS NOT NULL
  AND exam_source IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migrar datos existentes (preguntas psicotécnicas)
INSERT INTO question_official_exams (
  psychometric_question_id, exam_date, exam_source, oposicion_type, is_reserve
)
SELECT
  id,
  exam_date,
  exam_source,
  CASE
    WHEN exam_source ILIKE '%Auxiliar Administrativo Estado%' THEN 'auxiliar-administrativo-estado'
    WHEN exam_source ILIKE '%Tramitación Procesal%' THEN 'tramitacion-procesal'
    WHEN exam_source ILIKE '%Auxilio Judicial%' THEN 'auxilio-judicial'
    ELSE 'unknown'
  END,
  exam_source ILIKE '%Reserva%'
FROM psychometric_questions
WHERE is_official_exam = true
  AND exam_date IS NOT NULL
  AND exam_source IS NOT NULL
ON CONFLICT DO NOTHING;

-- Añadir comentarios a las columnas existentes para documentación
COMMENT ON COLUMN questions.exam_date IS 'Fecha de la CONVOCATORIA en BOE (NO la fecha del examen real)';
COMMENT ON COLUMN psychometric_questions.exam_date IS 'Fecha de la CONVOCATORIA en BOE (NO la fecha del examen real)';
COMMENT ON COLUMN question_official_exams.exam_date IS 'Fecha de la CONVOCATORIA en BOE (NO la fecha del examen real)';
