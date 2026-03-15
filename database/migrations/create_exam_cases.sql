-- exam_cases: Supuestos prácticos - enunciado compartido para grupos de preguntas
-- Las preguntas vinculadas (questions.exam_case_id) solo se muestran en exámenes oficiales,
-- nunca en tests normales.

CREATE TABLE IF NOT EXISTS exam_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_text TEXT NOT NULL,
  case_title TEXT,
  exam_date DATE,
  exam_source TEXT,
  oposicion_type TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permitir lectura pública (igual que questions)
ALTER TABLE exam_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_cases_read" ON exam_cases FOR SELECT USING (true);

-- FK en questions
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS exam_case_id UUID REFERENCES exam_cases(id) ON DELETE SET NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_questions_exam_case_id
  ON questions(exam_case_id) WHERE exam_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_exam_cases_exam_date
  ON exam_cases(exam_date, oposicion_type);
