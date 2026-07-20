-- backlog_tasks — estado de CLAIM del backlog general (docs/roadmap/tareas-pendientes.md).
--
-- Por qué existe: con 2-10 sesiones de Claude en paralelo, dos sesiones cogían la misma
-- tarea del backlog sin enterarse (caso real 20/07: una sesión montó worktree para el
-- RD 176/2022 cuando otra ya lo estaba arreglando). El markdown no admite claim atómico:
-- dos sesiones leen "libre", ambas escriben "EN CURSO", gana la última.
--
-- REPARTO DE RESPONSABILIDAD (deliberado, no duplicar):
--   - markdown  = CONTENIDO (título, por qué, cómo, hallazgos). Narrativa larga + git blame.
--   - esta tabla = ESTADO VOLÁTIL (quién la tiene, desde cuándo, en qué estado acabó).
--   El join es `id` ('T-042'), que va en la cabecera del markdown y NO cambia aunque
--   cambie el título. El guardarraíl __tests__/backlog/backlogRegistry.test.ts falla en CI
--   si markdown y tabla divergen (mismo patrón que runbookRegistry ↔ CLAUDE.md).
--
-- LEASE, NO LOCK: un lock sin caducidad se queda pillado cuando una sesión muere (se acaba
-- el contexto, peta, cierras la ventana). Un TTL fijo corto roba tareas legítimas de horas.
-- Solución: lease renovable por heartbeat → distingue "viva trabajando" de "murió hace 3h".

CREATE TABLE IF NOT EXISTS public.backlog_tasks (
  id           text PRIMARY KEY,            -- 'T-042'; estable aunque cambie el título
  title        text NOT NULL,
  priority     text NOT NULL DEFAULT 'media'
               CHECK (priority IN ('critica', 'alta', 'media', 'baja')),
  status       text NOT NULL DEFAULT 'open'
               CHECK (status IN ('open', 'in_progress', 'blocked', 'done', 'dropped')),

  -- claim (mismas semánticas que cola.cjs: claimed_by es el session-id, texto libre)
  claimed_by   text,
  claimed_at   timestamptz,
  lease_until  timestamptz,                 -- reclamable de nuevo si lease_until < now()

  blocked_by   text[] NOT NULL DEFAULT '{}',-- ids de otras tareas que la bloquean
  outcome      text,                        -- 1 línea al cerrar: qué pasó DE VERDAD
  closed_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  -- invariantes: no se puede estar cogida sin lease, ni cerrada sin fecha de cierre
  CONSTRAINT backlog_claim_coherente
    CHECK ((claimed_by IS NULL AND claimed_at IS NULL AND lease_until IS NULL)
        OR (claimed_by IS NOT NULL AND claimed_at IS NOT NULL AND lease_until IS NOT NULL)),
  CONSTRAINT backlog_cierre_coherente
    CHECK ((status IN ('done', 'dropped')) = (closed_at IS NOT NULL))
);

-- El índice sirve al caso caliente: listar/repartir lo que sigue vivo.
CREATE INDEX IF NOT EXISTS backlog_tasks_abiertas_idx
  ON public.backlog_tasks (priority, id) WHERE status IN ('open', 'in_progress', 'blocked');

CREATE OR REPLACE FUNCTION public.tg_backlog_tasks_touch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS backlog_tasks_touch ON public.backlog_tasks;
CREATE TRIGGER backlog_tasks_touch BEFORE UPDATE ON public.backlog_tasks
  FOR EACH ROW EXECUTE FUNCTION public.tg_backlog_tasks_touch();

COMMENT ON TABLE public.backlog_tasks IS
  'Estado de claim del backlog general. El CONTENIDO vive en docs/roadmap/tareas-pendientes.md; aquí solo el estado volátil. Join por id (T-xxx). Guardarraíl anti-divergencia en __tests__/backlog/backlogRegistry.test.ts.';
COMMENT ON COLUMN public.backlog_tasks.lease_until IS
  'Lease renovable por heartbeat. Si caduca, la tarea vuelve al pool aunque claimed_by siga puesto (sesión muerta).';
