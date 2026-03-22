-- Añadir campo deactivation_reason a questions
-- Registra el motivo por el que una pregunta fue desactivada
-- Se escribe automáticamente al desactivar, se limpia al reactivar

ALTER TABLE questions ADD COLUMN IF NOT EXISTS deactivation_reason TEXT NULL;

COMMENT ON COLUMN questions.deactivation_reason IS 'Motivo de desactivación: error de calidad, imagen no disponible, duplicada, etc.';

-- Backfill: preguntas inactivas con topic_review_status de error conocido
UPDATE questions
SET deactivation_reason = CASE topic_review_status
  WHEN 'bad_answer' THEN 'Respuesta incorrecta'
  WHEN 'bad_explanation' THEN 'Explicación incorrecta'
  WHEN 'bad_answer_and_explanation' THEN 'Respuesta y explicación incorrectas'
  WHEN 'wrong_article' THEN 'Artículo vinculado incorrecto'
  WHEN 'wrong_article_bad_explanation' THEN 'Artículo incorrecto y explicación incorrecta'
  WHEN 'wrong_article_bad_answer' THEN 'Artículo incorrecto y respuesta incorrecta'
  WHEN 'all_wrong' THEN 'Todo incorrecto (respuesta, explicación y artículo)'
  WHEN 'invalid_structure' THEN 'Estructura inválida (opciones vacías, texto vacío)'
  WHEN 'tech_bad_answer' THEN 'Respuesta incorrecta (informática)'
  WHEN 'tech_bad_answer_and_explanation' THEN 'Respuesta y explicación incorrectas (informática)'
  WHEN 'tech_bad_explanation' THEN 'Explicación incorrecta (informática)'
  ELSE topic_review_status
END
WHERE is_active = false
  AND deactivation_reason IS NULL
  AND topic_review_status IS NOT NULL
  AND topic_review_status NOT IN ('perfect', 'tech_perfect', 'pending', 'NULL');

-- Backfill: las de Windows 10 obsoleto que ya tenían el motivo en topic_review_status
UPDATE questions
SET deactivation_reason = topic_review_status,
    topic_review_status = NULL
WHERE is_active = false
  AND topic_review_status LIKE 'Desactivada:%';
