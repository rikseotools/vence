-- 20260729_user_question_favorites_contexto.sql
-- Contexto de DÓNDE guardó el usuario la pregunta (T-261, decisión 29/07).
--
-- POR QUÉ AHORA y no cuando haga falta agrupar:
-- Una pregunta NO pertenece a una oposición ni a un tema — cuelga de un ARTÍCULO, y el
-- tema se forma después vía `topic_scope` según la oposición (modelo nuclear, CLAUDE.md).
-- Así que "el tema de esta favorita" solo existe EN RELACIÓN a quien la guardó. Si no se
-- anota en el momento, el dato no se puede reconstruir después: la misma pregunta aparece
-- en temas distintos de oposiciones distintas y solo se podría adivinar.
--
-- Ambas columnas son NULLABLE a propósito:
--  · Guardar desde un test por leyes (`/leyes/...`) o desde el repaso de favoritas no
--    tiene tema, y eso es legítimo, no un dato que falte.
--  · Migración additiva pura: lo ya guardado sigue siendo válido con contexto vacío.
--
-- Sin FK a `topics`: `topic_number` es el número del tema DENTRO de una oposición
-- (el par (position_type, topic_number) es lo que identifica), no un id de fila; y
-- un renumerado del temario no debe borrar la marca del usuario.

ALTER TABLE public.user_question_favorites
  ADD COLUMN IF NOT EXISTS position_type text,
  ADD COLUMN IF NOT EXISTS topic_number  integer;

COMMENT ON COLUMN public.user_question_favorites.position_type IS
  'Oposición en la que el usuario estaba cuando guardó la pregunta. NULL si la guardó '
  'fuera de una oposición (tests por leyes). Se anota al marcar porque no es '
  'reconstruible después.';

COMMENT ON COLUMN public.user_question_favorites.topic_number IS
  'Tema (dentro de esa oposición) en el que estaba al guardarla. NULL si el test no '
  'era de un tema concreto.';

-- Agrupar "mis guardadas de esta oposición" sin escanear todas las del usuario.
CREATE INDEX IF NOT EXISTS user_question_favorites_user_position_idx
  ON public.user_question_favorites (user_id, position_type);
