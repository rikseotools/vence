-- Barajar opciones — FASE 1 (tajada inerte: columnas additivas, sin efecto hasta encender el flag).
--
-- Origen: 34% de todas las exposiciones son repetición y el 77,4% de los usuarios
-- ACTIVOS (≥50 preg) ven preguntas repetidas → memorizan la POSICIÓN de la correcta
-- en vez del contenido (feedback 4eeffbc9, 21/07). Diseño y spec completos:
-- docs/roadmap/barajar-opciones-fase1-spec.md + tarea T-080 en tareas-pendientes.md.
--
-- Estas dos columnas son inertes por sí solas: mientras FEATURE_SHUFFLE_OPTIONS esté
-- off y no se toque el fetcher/validador, el comportamiento es idéntico al actual.

-- 1) Clasificación de barajabilidad de las opciones de una pregunta.
--    DEFAULT 'no_shuffle' A PROPÓSITO: hasta que el backfill clasifique, NO se baraja
--    (sesgo seguro; barajar de más = romper una pregunta, no barajar de más = inocuo).
--    'full'        → opciones independientes, se pueden barajar libremente.
--    'anchor_last' → hay una opción tipo "Ninguna/Todas (las anteriores)": se barajan
--                    las demás y esa se ancla al final.
--    'no_shuffle'  → opciones que se cruzan por letra/número/ordinal ("A y B son
--                    correctas", "las dos primeras", "respuestas 1 y 2"): barajar rompe.
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS shuffle_mode text NOT NULL DEFAULT 'no_shuffle';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'questions_shuffle_mode_check'
  ) THEN
    ALTER TABLE public.questions
      ADD CONSTRAINT questions_shuffle_mode_check
      CHECK (shuffle_mode IN ('full','anchor_last','no_shuffle'));
  END IF;
END$$;

COMMENT ON COLUMN public.questions.shuffle_mode IS
  'Barajabilidad de las opciones (barajar-opciones Fase 1). Default no_shuffle = seguro hasta clasificar. full | anchor_last | no_shuffle. Clasificador: lib/shuffle/classifyShuffleMode.ts. Añadido 22/07/2026.';

-- 2) Permutación aplicada al servir cada exposición de la pregunta.
--    option_order[i] = índice ORIGINAL en BD (0=A, 1=B, ...) que se mostró en la
--    posición i. NULL = sin barajar (orden natural) → 100% retrocompatible con todo
--    lo histórico. Es la FUENTE DE VERDAD para mapear "posición mostrada → opción
--    original" en la validación server-side (que compara contra questions.correct_option).
ALTER TABLE public.test_questions
  ADD COLUMN IF NOT EXISTS option_order integer[] NULL;

COMMENT ON COLUMN public.test_questions.option_order IS
  'Permutación aplicada al servir: option_order[i] = índice original (0=A) mostrado en la posición i. NULL = orden natural. Usada para mapear la respuesta mostrada → opción original en la validación. Añadido 22/07/2026.';
