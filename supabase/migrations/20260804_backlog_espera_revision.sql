-- T-539 — La QUINTA espera: «hecho, esperando que una persona lo revise».
--
-- ── POR QUÉ ──────────────────────────────────────────────────────────────────────────────────
-- El backlog modela cuatro esperas, cada una con su campo, y `claim` las impide todas:
--   · persona   → claimed_by + lease_until
--   · tarea     → blocked_by
--   · reloj     → snooze_until
--   · deploy    → wake_on_deploy_sha
--
-- Falta la que va a ser MÁS FRECUENTE en cuanto haya trabajadores autónomos: el trabajo está
-- hecho, hay un entregable, y no puede avanzar hasta que una persona lo mire. No la despierta un
-- reloj ni un deploy: la despierta alguien.
--
-- ── LO QUE HABÍA, Y POR QUÉ NO BASTA ────────────────────────────────────────────────────────
-- Se DEDUCÍA del texto: `clasificarEspera()` pasa cinco expresiones regulares por `resume_check`
-- («decisión de manuel», «ok de manuel», «decidir»…) y si ninguna casa, la tarea cae en la lista
-- de «verificar». Su propio comentario justificaba la heurística: *«no hay campo para esto y
-- añadir uno costaría una migración para algo que se resuelve leyendo lo que la gente YA
-- escribe»*.
--
-- La primera vuelta del piloto de flota (04/08) demostró que ese razonamiento no se sostiene con
-- trabajadores: el trabajador terminó una auditoría, dejó una propuesta lista para revisar, y **no
-- tenía comando con el que decirlo**. Acabó en `pause --hasta "2026-08-06 09:00"` con una fecha
-- INVENTADA, porque su bloqueo no era el reloj. Lo reportó él mismo: *«si la flota crece, "hecho,
-- esperando revisión humana" va a ser el estado final más frecuente y hoy no tiene comando propio»*.
--
-- Es el mismo patrón que este repo ya corrigió DOS veces —`snooze_until` (una fecha en el título
-- no es una condición) y `due_at` (un plazo en prosa no es un plazo)—: **una condición en prosa no
-- es una condición**. La heurística de texto se conserva SOLO como respaldo para las filas
-- antiguas; a partir de aquí manda la columna.
--
-- Aditiva y nullable: nada de lo que hay hoy cambia de comportamiento. Idempotente.

ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS review_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS review_note          text,
  ADD COLUMN IF NOT EXISTS review_requested_by  text;

COMMENT ON COLUMN public.backlog_tasks.review_requested_at IS
  'T-539 — quinta espera: hecho y esperando que una PERSONA lo revise. No la despierta el reloj ni el deploy.';
COMMENT ON COLUMN public.backlog_tasks.review_note IS
  'T-539 — QUÉ hay que revisar y dónde está el entregable. Obligatorio: sin esto, quien revise no sabe qué mirar.';
COMMENT ON COLUMN public.backlog_tasks.review_requested_by IS
  'T-539 — qué sesión lo dejó a revisión, para poder preguntarle.';

-- Los tres campos van juntos o no van: una petición de revisión sin nota es exactamente el hueco
-- que esto viene a cerrar (quien revisa no sabría qué mirar), y una nota sin fecha no se ordena.
-- Se hace cumplir en la BD y no solo en el CLI, por la misma razón que el CHECK de `due_reason`:
-- el CLI se puede saltar, la tabla no.
ALTER TABLE public.backlog_tasks
  DROP CONSTRAINT IF EXISTS backlog_tasks_review_completo_check;
ALTER TABLE public.backlog_tasks
  ADD CONSTRAINT backlog_tasks_review_completo_check
  CHECK (
    (review_requested_at IS NULL AND review_note IS NULL)
    OR (review_requested_at IS NOT NULL AND review_note IS NOT NULL AND length(btrim(review_note)) >= 20)
  );

-- Se consulta por «¿qué está esperando revisión?», que es una lista corta sobre una tabla que
-- crece: índice parcial, que solo indexa las que lo esperan.
CREATE INDEX IF NOT EXISTS idx_backlog_tasks_esperando_revision
  ON public.backlog_tasks (review_requested_at)
  WHERE review_requested_at IS NOT NULL;
