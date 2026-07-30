-- T-296 — Latido de las sesiones de trabajo (worktrees), para saber qué se puede borrar.
--
-- POR QUÉ: con 2-10 sesiones de Claude en paralelo había 15 worktrees y ninguna forma de saber
-- cuáles estaban en uso. La limpieza acababa en conjeturas (la fecha del directorio no sirve: una
-- sesión viva pasa horas sin tocar su worktree; el `cwd` de las transcripciones dice siempre el
-- repo principal). Lo único que prueba vida es una señal con hora, y no existía.
--
-- POR QUÉ EN RDS Y NO EN UN FICHERO: es exactamente el mismo motivo que `backlog_tasks`. El
-- registro `/tmp/vence-sessions.tsv` que ya usaba `session-start.sh` es per-máquina y efímero, y un
-- fichero no admite escritura concurrente de 10 procesos sin perder líneas.
--
-- Additiva y sin FKs: es telemetría de desarrollo, no dato de negocio. Si se pierde, el peor caso
-- es volver a no saber qué borrar.
CREATE TABLE IF NOT EXISTS public.worktree_sessions (
  sid             text PRIMARY KEY,
  slug            text,
  worktree_path   text,
  branch          text,
  host            text,
  -- La señal. Es lo único que no se puede deducir de git ni del disco.
  last_signal_at  timestamptz NOT NULL DEFAULT now(),
  last_command    text,
  -- Cuántas veces ha latido: distingue una sesión que trabaja de una que arrancó y murió.
  signals         integer NOT NULL DEFAULT 1,
  first_signal_at timestamptz NOT NULL DEFAULT now()
);

-- El listado ordena por señal reciente; con decenas de filas basta este índice.
CREATE INDEX IF NOT EXISTS idx_worktree_sessions_signal
  ON public.worktree_sessions (last_signal_at DESC);

-- Por slug, porque la pregunta operativa se hace sobre el DIRECTORIO («¿borro este?»), y un mismo
-- slug puede haber tenido varios sid a lo largo del tiempo (worktree recreado con el mismo nombre).
CREATE INDEX IF NOT EXISTS idx_worktree_sessions_slug
  ON public.worktree_sessions (slug);

COMMENT ON TABLE public.worktree_sessions IS
  'T-296: latido de las sesiones de trabajo en worktree. Lo escribe scripts/sessions/latir.cjs (invocado por backlog.cjs en cada comando y por el hook pre-push); lo lee scripts/worktrees/listar-worktrees.sh. Responde a «¿puedo borrar este worktree?».';
