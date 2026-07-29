-- 20260729_user_question_favorites.sql
-- Marcar una PREGUNTA como favorita y repasar solo las guardadas (T-261).
-- Petición de Laura Zurdo (premium, aux. admin. Madrid, feedback 46372450, 28/07/2026):
-- «un botón con el icono de un corazón en cada pregunta … y una sección donde repasar
-- únicamente las preguntas que ha guardado en favoritos».
--
-- Por qué una tabla nueva y no reutilizar lo que hay:
--  · `user_test_favorites` NO sirve: guarda CONFIGURACIONES de test (nombre + leyes +
--    artículos seleccionados), no preguntas. Nombre parecido, dominio distinto.
--  · El repaso de fallos (`test_questions` con is_correct=false) es una selección
--    AUTOMÁTICA por rendimiento; esto es una selección MANUAL del usuario. Son dos ejes
--    distintos y deben poder combinarse (una pregunta puede estar fallada y marcada).
--
-- Decisiones de diseño:
--  · UNIQUE (user_id, question_id) → marcar dos veces es idempotente por construcción,
--    igual que `unique_test_question` hace idempotente el guardado de respuestas. El
--    endpoint no necesita comprobar antes de insertar (evita la carrera del doble clic).
--  · ON DELETE CASCADE en las dos FKs: si se borra la cuenta (RGPD) o se retira una
--    pregunta, su marca se va con ella. Nada de filas huérfanas apuntando a nada.
--  · Índice por (user_id, created_at DESC) → la sección de repaso lista "las últimas que
--    guardé" sin ordenar en memoria.
--  · `question_id` referencia `questions` (legislativas). Las psicotécnicas viven en otra
--    tabla y una FK solo puede apuntar a una; cuando se quieran marcar, se añade una
--    columna nullable + CHECK de exclusividad, como hace `reward_submissions`.

CREATE TABLE IF NOT EXISTS public.user_question_favorites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_question_favorites_unique UNIQUE (user_id, question_id)
);

-- Listado del usuario, más recientes primero (el orden que usa la sección de repaso).
CREATE INDEX IF NOT EXISTS user_question_favorites_user_created_idx
  ON public.user_question_favorites (user_id, created_at DESC);

-- "¿Quién tiene marcada esta pregunta?" — para métricas de contenido (una pregunta muy
-- marcada es señal de material valioso o de material confuso) sin escanear por user_id.
CREATE INDEX IF NOT EXISTS user_question_favorites_question_idx
  ON public.user_question_favorites (question_id);

COMMENT ON TABLE public.user_question_favorites IS
  'Preguntas marcadas manualmente por el usuario (corazón) para repasarlas después. '
  'Distinto de user_test_favorites (configuraciones de test) y del repaso de fallos '
  '(selección automática por rendimiento). T-261, petición de usuaria 28/07/2026.';
