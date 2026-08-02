-- T-493 — El EMBUDO: las preguntas de las sesiones a Manuel, en un solo sitio.
--
-- ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
-- Con 2-10 sesiones en paralelo, Manuel no puede entrar en cada terminal a ver si alguien le
-- necesita («yo lo que no quiero es estarme metiendo en cada una de las sesiones»). Hasta hoy una
-- duda solo tenía dos destinos, y los dos malos:
--
--   · la terminal de la sesión, donde muere cuando la sesión muere;
--   · el campo `resume_check` de una tarea PAUSADA, donde `clasificarEspera` intenta adivinar con
--     cinco expresiones regulares si el texto pide una decisión. Si la sesión escribe «falta que
--     Manuel me diga si esto va a producción», ninguna casa y la pregunta DESAPARECE de la lista.
--
-- Y obligaba a PAUSAR la tarea para poder preguntar, que es una condición inventada: se puede
-- tener una duda y seguir trabajando en otra cosa.
--
-- ── POR QUÉ TABLA PROPIA Y NO UNA COLUMNA MÁS ───────────────────────────────────────────────
-- Una pregunta es un OBJETO, no un adjetivo de una tarea: tiene autor, hora, respuesta, y puede
-- no ir asociada a ninguna tarea (dudas de rumbo, de prioridad, de negocio). Meterla en
-- `backlog_tasks` obligaría a inventar una tarea para poder preguntar.
--
-- ── SIN LEASE, A PROPÓSITO ──────────────────────────────────────────────────────────────────
-- Todo lo demás de este andamiaje caduca (claims, reservas, aplazamientos) porque lo que caduca
-- se libera solo. Una pregunta NO: caducar sería perderla, que es exactamente el fallo que esta
-- tabla arregla. Se cierra al responderla o al retirarla, nunca por el reloj.

CREATE TABLE IF NOT EXISTS public.session_questions (
  id          bigserial PRIMARY KEY,
  -- Quién pregunta. Mismo identificador que el claim y el latido (lib/sessions/sid.cjs).
  sid         text NOT NULL,
  -- La tarea de la que sale, si sale de alguna. NULLABLE a propósito: hay dudas de rumbo que no
  -- cuelgan de ninguna ficha, y exigir una obligaría a inventarla.
  task_id     text,
  question    text NOT NULL CHECK (length(btrim(question)) >= 15),
  -- El contexto que hace que la pregunta se pueda contestar SIN abrir la sesión: qué se ha mirado
  -- ya, qué opciones hay. Es lo que convierte el embudo en algo que se contesta en un minuto.
  context     text,
  -- ¿La sesión puede seguir trabajando mientras espera? Se DECLARA, no se deduce del tono.
  -- Preguntar no bloquea (avisar ≠ bloquear); si de verdad no se puede avanzar, eso ya tiene
  -- nombre en el sistema y es `pause`.
  blocking    boolean NOT NULL DEFAULT false,
  asked_at    timestamptz NOT NULL DEFAULT now(),
  answer      text,
  answered_at timestamptz,
  answered_by text,
  -- Cuándo la sesión LEYÓ la respuesta. Sin esto, el aviso se repetiría para siempre y se
  -- volvería ruido — el modo en que mueren los avisos de este repo.
  seen_at     timestamptz,
  -- 'open' | 'answered' | 'withdrawn' (la sesión la resolvió sola y lo dice).
  status      text NOT NULL DEFAULT 'open'
              CHECK (status IN ('open', 'answered', 'withdrawn')),
  withdrawn_reason text
);

-- La consulta que se hace todo el rato: «¿qué hay pendiente de contestar?», lo más viejo primero.
CREATE INDEX IF NOT EXISTS idx_session_questions_open
  ON public.session_questions (asked_at) WHERE status = 'open';

-- Y la del otro lado: «¿me han contestado algo que aún no he leído?».
CREATE INDEX IF NOT EXISTS idx_session_questions_sid
  ON public.session_questions (sid, status);

COMMENT ON TABLE public.session_questions IS
  'T-493: el embudo de preguntas de las sesiones a Manuel. Lo escribe scripts/backlog.cjs '
  '(preguntar/responder/retirar); lo lee `list` y el parte de sesiones. Sin lease: una pregunta '
  'no caduca sola, porque caducar sería perderla.';
