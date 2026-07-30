-- 20260731_backlog_fecha_limite.sql
--
-- Fecha límite en el backlog: «tiene que estar ANTES de».
--
-- ── POR QUÉ FALTABA ─────────────────────────────────────────────────────────
-- `backlog_tasks` ya modelaba cuatro esperas —persona (`claimed_by`), otra tarea
-- (`blocked_by`), reloj (`snooze_until`) y despliegue (`wake_on_deploy_sha`)— y las cuatro
-- significan lo mismo: **no la cojas todavía**. Ninguna decía **tiene que estar antes de**.
-- Son opuestas, y confundirlas es fácil: el 30/07/2026, buscando dónde anotar un plazo
-- prometido a una usuaria, lo primero que se miró fue `snooze_until`… que la habría BLOQUEADO
-- justo hasta el día en que vencía. Sin sitio donde ponerlo, el plazo acabó en prosa dentro de
-- la ficha, y una condición en prosa no es una condición (misma lección que ya ganó
-- `snooze_until` cuando T-221 llevaba «⛔ NO COGER HASTA EL 29/07» en el título).
--
-- Caso que lo motiva: T-330, una newsletter cuyo valor moría el 31/07 a las 23:59 (cerraba el
-- plazo que anunciaba). Doce horas de vida, y lo único que lo decía era la palabra «hoy» en un
-- título escrito el día anterior.
--
-- ── EL MOTIVO ES OBLIGATORIO, Y ES LO QUE SOSTIENE EL CAMPO ─────────────────
-- Con 127 tareas abiertas y tres o cuatro plazos reales, permitir inventarlos convierte el
-- campo en ruido: en un mes todo es urgente y nada lo es. Un plazo exige un motivo EXTERNO —
-- una persona a la que se lo dijimos, o una fecha que fija un tercero (boletín, plazo
-- administrativo, examen). El CHECK lo hace físico: no se puede escribir la fecha sin el porqué.
--
-- NO toca `priority` a propósito: urgencia e importancia son cosas distintas, y mezclarlas es
-- como estos sistemas acaban con todo en rojo.
--
-- Aditiva y reversible: dos columnas nuevas, sin defaults que cambien filas existentes.

ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS due_at     timestamptz,
  ADD COLUMN IF NOT EXISTS due_reason text;

COMMENT ON COLUMN public.backlog_tasks.due_at IS
  'Fecha límite: la tarea tiene que estar ANTES de aquí. NO confundir con snooze_until, que es '
  'lo contrario (no cogerla ANTES de). Pasado el plazo la tarea no se pospone: se decide.';
COMMENT ON COLUMN public.backlog_tasks.due_reason IS
  'Motivo EXTERNO del plazo: quién lo espera o qué fecha de un tercero lo fija. Obligatorio '
  'junto a due_at — un plazo sin motivo es una preferencia disfrazada.';

-- Los dos van juntos o no van.
ALTER TABLE public.backlog_tasks
  DROP CONSTRAINT IF EXISTS backlog_tasks_due_con_motivo;
ALTER TABLE public.backlog_tasks
  ADD CONSTRAINT backlog_tasks_due_con_motivo
  CHECK ((due_at IS NULL AND due_reason IS NULL)
      OR (due_at IS NOT NULL AND btrim(coalesce(due_reason, '')) <> ''));

-- El triaje pregunta siempre por lo mismo: qué vence pronto y sigue vivo.
CREATE INDEX IF NOT EXISTS idx_backlog_tasks_due_at
  ON public.backlog_tasks (due_at)
  WHERE due_at IS NOT NULL AND status NOT IN ('done', 'closed', 'rejected');
