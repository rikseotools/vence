-- Migración: Añadir campos para revisión de temas con IA
-- Fecha: 2025-12-21
-- Descripción: Sistema de verificación con 8 estados basado en 3 variables booleanas

-- ============================================
-- 1. TABLA questions - Campo topic_review_status
-- ============================================

-- Estados posibles (8 combinaciones de 3 variables):
-- | articleOk | answerOk | explanationOk | Estado |
-- |-----------|----------|---------------|--------|
-- | ✅ | ✅ | ✅ | perfect |
-- | ✅ | ✅ | ❌ | bad_explanation |
-- | ✅ | ❌ | ✅ | bad_answer |
-- | ✅ | ❌ | ❌ | bad_answer_and_explanation |
-- | ❌ | ✅ | ✅ | wrong_article |
-- | ❌ | ✅ | ❌ | wrong_article_bad_explanation |
-- | ❌ | ❌ | ✅ | wrong_article_bad_answer |
-- | ❌ | ❌ | ❌ | all_wrong |

ALTER TABLE questions
ADD COLUMN IF NOT EXISTS topic_review_status TEXT;

-- Crear índice para filtrar por estado de revisión
CREATE INDEX IF NOT EXISTS idx_questions_topic_review_status
ON questions(topic_review_status)
WHERE topic_review_status IS NOT NULL;

COMMENT ON COLUMN questions.topic_review_status IS 'Estado de revisión por tema: perfect, bad_explanation, bad_answer, bad_answer_and_explanation, wrong_article, wrong_article_bad_explanation, wrong_article_bad_answer, all_wrong, pending/null';

-- ============================================
-- 2. TABLA ai_verification_results - Nuevos campos
-- ============================================

-- 3 variables booleanas independientes
ALTER TABLE ai_verification_results
ADD COLUMN IF NOT EXISTS article_ok BOOLEAN;

ALTER TABLE ai_verification_results
ADD COLUMN IF NOT EXISTS answer_ok BOOLEAN;

ALTER TABLE ai_verification_results
ADD COLUMN IF NOT EXISTS explanation_ok BOOLEAN;

-- Campos adicionales para sugerencias de corrección
ALTER TABLE ai_verification_results
ADD COLUMN IF NOT EXISTS correct_article_suggestion TEXT;

ALTER TABLE ai_verification_results
ADD COLUMN IF NOT EXISTS explanation_fix TEXT;

-- Comentarios para documentación
COMMENT ON COLUMN ai_verification_results.article_ok IS '¿El artículo vinculado es literal y responde la pregunta?';
COMMENT ON COLUMN ai_verification_results.answer_ok IS '¿La opción marcada como correcta es realmente correcta?';
COMMENT ON COLUMN ai_verification_results.explanation_ok IS '¿La explicación es correcta y coherente?';
COMMENT ON COLUMN ai_verification_results.correct_article_suggestion IS 'Si article_ok=false, qué artículo/ley debería estar vinculado';
COMMENT ON COLUMN ai_verification_results.explanation_fix IS 'Si explanation_ok=false, qué está mal en la explicación';

-- ============================================
-- 3. Índices para consultas eficientes
-- ============================================

-- Índice para encontrar preguntas con artículo mal vinculado
CREATE INDEX IF NOT EXISTS idx_ai_verification_article_ok
ON ai_verification_results(article_ok)
WHERE article_ok = false;

-- Índice para encontrar preguntas con respuesta incorrecta
CREATE INDEX IF NOT EXISTS idx_ai_verification_answer_ok
ON ai_verification_results(answer_ok)
WHERE answer_ok = false;

-- Índice para encontrar preguntas con explicación incorrecta
CREATE INDEX IF NOT EXISTS idx_ai_verification_explanation_ok
ON ai_verification_results(explanation_ok)
WHERE explanation_ok = false;
