-- T-486 — el EMBUDO también lleva BORRADORES, no solo preguntas.
--
-- ── LA REGLA QUE LO PIDE ────────────────────────────────────────────────────────────────────
-- «No puedo permitir que los trabajadores envíen correos sin mi supervisión. Siempre tengo que
-- aprobar lo que se envía, porque ahí se detectan fallos y los usuarios necesitan que haya
-- personas detrás, no la IA.» (Manuel, 05/08)
--
-- La mitad de eso ya está resuelta por PERMISO: un trabajador no tiene credenciales con las que
-- enviar, y ahora además los tres scripts que envían (impugnaciones, feedback, newsletter) se
-- niegan si el rol no es `persona` (`lib/sessions/aprobacion.cjs`).
--
-- Pero eso solo dice que NO se envía. Faltaba lo otro: **dónde va lo que sí se ha redactado**. Sin
-- un sitio, el borrador se queda en el log de una terminal que nadie mira — que es exactamente el
-- fallo que el embudo (`session_questions`, T-493) vino a cerrar para las preguntas.
--
-- ── POR QUÉ AQUÍ Y NO EN UNA TABLA NUEVA ────────────────────────────────────────────────────
-- Es el MISMO canal: cosas que una sesión le manda a Manuel y que esperan su palabra. Una tabla
-- aparte significaría dos colas, dos comandos, dos sitios donde mirar y una de las dos olvidada.
-- Lo único que cambia es la naturaleza de lo que espera, así que lo que se añade es un tipo.
--
-- Idempotente.

ALTER TABLE public.session_questions
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'pregunta';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_questions_kind_check'
  ) THEN
    ALTER TABLE public.session_questions
      ADD CONSTRAINT session_questions_kind_check CHECK (kind IN ('pregunta', 'borrador'));
  END IF;
END $$;

COMMENT ON COLUMN public.session_questions.kind IS
  'T-486 — «pregunta» (necesito una decisión) o «borrador» (esto es lo que se le enviaría a una persona; NADA sale sin que Manuel lo apruebe).';

-- A quién iba dirigido. Solo tiene sentido en un borrador, y ahí es OBLIGATORIO: un borrador sin
-- destinatario no se puede revisar (¿a quién le estoy diciendo esto?), que es la misma lección que
-- ganó `--entrega` en la quinta espera.
ALTER TABLE public.session_questions
  ADD COLUMN IF NOT EXISTS draft_target text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_questions_borrador_check'
  ) THEN
    ALTER TABLE public.session_questions
      ADD CONSTRAINT session_questions_borrador_check CHECK (
        kind <> 'borrador'
        OR (
          -- El TEXTO ÍNTEGRO de lo que se enviaría va en `context`, y sin él no hay nada que
          -- aprobar. 40 caracteres es el suelo por debajo del cual no es un mensaje.
          context IS NOT NULL AND length(btrim(context)) >= 40
          AND draft_target IS NOT NULL AND length(btrim(draft_target)) >= 3
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.session_questions.draft_target IS
  'T-486 — a quién iría dirigido el borrador (impugnación, feedback, lista…). Obligatorio en los borradores: sin destinatario no se puede revisar.';

-- Los borradores pendientes se listan a menudo (panel de la flota + `backlog list`) y son pocos:
-- índice parcial, como el de la quinta espera.
CREATE INDEX IF NOT EXISTS idx_session_questions_borradores
  ON public.session_questions (asked_at)
  WHERE kind = 'borrador' AND status = 'open';
