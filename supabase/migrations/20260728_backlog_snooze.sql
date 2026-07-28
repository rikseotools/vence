-- T-252 — aplazar una tarea que espera a un RELOJ, no a una persona.
--
-- El backlog ya sabía decir "la estoy haciendo yo" (claimed_by + lease_until) y "depende de otra
-- tarea nuestra" (blocked_by). Le faltaba el tercer caso, que es el más común de los tres: la
-- tarea está lista pero no hay NADA que hacer hasta cierta hora — el cron nocturno que aún no ha
-- corrido, la cosecha que termina mañana, la fecha en que toca medir.
--
-- Hasta hoy eso se resolvía gritando en el markdown: T-221 llevaba literalmente
-- "⛔ NO COGER HASTA EL 29/07 07:00 UTC" EN EL TÍTULO, y aun así `next` la ofrecía, porque ni el
-- CLI ni la tabla miran el texto de la ficha. Con 2-10 sesiones en paralelo, eso es otra sesión
-- montando un worktree para descubrir a los cinco minutos que no había nada que medir.
--
-- Es un APLAZAMIENTO, no un candado: vence solo (igual que el lease) y `claim` no lo impide,
-- solo avisa — a veces sí quieres adelantar el trabajo preparatorio.
ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS snooze_until  timestamptz,
  ADD COLUMN IF NOT EXISTS snooze_reason text,
  ADD COLUMN IF NOT EXISTS snoozed_by    text;

COMMENT ON COLUMN public.backlog_tasks.snooze_until IS
  'Hasta cuándo no tiene sentido cogerla (espera a un reloj externo: cron, cosecha, fecha). NULL = despierta. Vence sola.';
COMMENT ON COLUMN public.backlog_tasks.snooze_reason IS
  'Por qué espera y qué se mira al despertar. Obligatorio en el CLI: un aplazamiento sin motivo es indistinguible de un olvido.';

-- El pool se consulta en cada `list`/`next`: que el filtro de dormidas no sea un scan.
CREATE INDEX IF NOT EXISTS backlog_tasks_snooze_until_idx
  ON public.backlog_tasks (snooze_until)
  WHERE snooze_until IS NOT NULL;
