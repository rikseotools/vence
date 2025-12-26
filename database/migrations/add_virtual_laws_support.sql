-- Migración: Soporte para leyes virtuales/técnicas
-- Fecha: 2025-12-21
-- Descripción: Las leyes virtuales son pseudo-leyes creadas para vincular
--              preguntas de temas técnicos (informática, ofimática) que no
--              tienen base legal real.
--
-- NOTA: Las leyes virtuales se detectan automáticamente por tener
--       "Ley ficticia" en su campo `description`. No se requiere
--       campo adicional en la tabla `laws`.

-- ============================================
-- LEYES VIRTUALES EXISTENTES (referencia)
-- ============================================
-- Se detectan por: description ILIKE '%ficticia%'
--
-- Listado actual:
-- - Informática Básica
-- - Windows 10
-- - Explorador de Windows
-- - Procesadores de texto
-- - Hojas de cálculo. Excel
-- - Base de datos: Access
-- - Correo electrónico
-- - La Red Internet

-- ============================================
-- ESTADOS TÉCNICOS PARA PREGUNTAS
-- ============================================
--
-- Para preguntas de temas técnicos (leyes virtuales), el campo
-- topic_review_status puede tener estos valores adicionales:
--
-- | Estado | Descripción |
-- |--------|-------------|
-- | tech_perfect | Técnicamente correcto (ley virtual) |
-- | tech_bad_answer | Respuesta incorrecta (ley virtual) |
-- | tech_bad_explanation | Explicación incorrecta (ley virtual) |
-- | tech_bad_answer_and_explanation | Ambos incorrectos (ley virtual) |
--
-- El campo article_ok será NULL para leyes virtuales ya que no aplica
-- verificación de artículo legal.

-- ============================================
-- VERIFICACIÓN DE LEYES VIRTUALES
-- ============================================

-- Query para listar todas las leyes virtuales:
-- SELECT short_name, name, description
-- FROM laws
-- WHERE description ILIKE '%ficticia%';

-- Query para contar preguntas de leyes virtuales:
-- SELECT l.short_name, COUNT(q.id) as preguntas
-- FROM questions q
-- JOIN articles a ON q.primary_article_id = a.id
-- JOIN laws l ON a.law_id = l.id
-- WHERE l.description ILIKE '%ficticia%'
-- GROUP BY l.short_name;

-- ============================================
-- SOPORTE PARA VIDEOS EN LEYES VIRTUALES
-- ============================================
-- Fecha añadido: 2025-12-26

-- Añadir campo para URL del video explicativo
ALTER TABLE laws ADD COLUMN IF NOT EXISTS video_url TEXT;

COMMENT ON COLUMN laws.video_url IS 'URL del video explicativo (YouTube, etc.) para leyes virtuales';

-- Ejemplo de uso:
-- UPDATE laws SET video_url = 'https://www.youtube.com/watch?v=RuYQ8EqwV4U'
-- WHERE short_name = 'Windows 11';
