-- Nivel de prioridad "ninguna" = tarea APARCADA por tamaño/coste.
--
-- Por qué: T-040 (artículos-cajón, ~21.000 preguntas sobre 110 mega-chunks) es la de
-- más impacto del backlog y también la más cara: agotaría el presupuesto de tokens de
-- una sesión entera. Decisión de Manuel (20/07): que no tenga prioridad y quede la
-- última. "baja" no servía — sigue entrando en el reparto y `backlog.cjs next` la
-- acabaría sugiriendo cuando el resto estuviera cogido.
--
-- Semántica: 'ninguna' NO es "muy baja". Es que la tarea no participa del reparto
-- automático; se coge solo a propósito, cuando haya presupuesto para ella.
-- Ver scripts/backlog.cjs (rank 9, `next` la filtra, `list` la pinta ⬜ y la última).
ALTER TABLE public.backlog_tasks DROP CONSTRAINT IF EXISTS backlog_tasks_priority_check;
ALTER TABLE public.backlog_tasks ADD CONSTRAINT backlog_tasks_priority_check
  CHECK (priority IN ('critica', 'alta', 'media', 'baja', 'ninguna'));

UPDATE public.backlog_tasks SET priority = 'ninguna', updated_at = now() WHERE id = 'T-040';
