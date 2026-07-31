-- T-404 — registro consultable de despliegues: quién, qué, desde cuándo y en qué acabó.
--
-- EL HUECO: la cola de deploys YA EXISTE y funciona (flock en /tmp/vence-deploy.lock, T-386) —
-- pero es INVISIBLE hasta que la usas. Hoy no hay forma de preguntar «¿hay alguien desplegando
-- ahora mismo?» sin lanzar el deploy y quedarte esperando el lock hasta 45 min. Así que varias
-- sesiones proponen desplegar a la vez sin poder saber que otra ya va.
--
-- Un fichero en /tmp tampoco sirve para contestarlo: no aparece en `list`, ni en el mapa de
-- sesiones, ni sobrevive a un reinicio, ni distingue «tomado» de «un deploy murió y dejó el
-- fichero». Esto va donde ya vive todo lo demás que las sesiones consultan.
--
-- OJO — esta tabla NO es la verdad sobre si alguien despliega: es lo que alguien DECLARÓ al
-- empezar. La verdad la tiene el lock (y el proceso vivo). Quien lea debe cruzar las dos y
-- decirlo cuando discrepan, igual que se aprendió con los claims muertos (`backlog.cjs reap`):
-- un marcador rancio que se lee como «ocupado» es peor que no tener marcador.

CREATE TABLE IF NOT EXISTS public.deploy_runs (
  id           bigserial PRIMARY KEY,
  surface      text        NOT NULL CHECK (surface IN ('frontend', 'backend')),
  sha          text,
  sid          text,                      -- session-id de quien lanzó (mismo que worktree_sessions)
  slug         text,                      -- worktree desde el que se lanzó
  host         text,
  pid          integer,                   -- permite comprobar si SIGUE vivo, en vez de adivinar por edad
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  outcome      text CHECK (outcome IN ('ok', 'fail', 'abortado')),
  note         text
);

-- La consulta caliente es «¿hay alguno sin terminar?»: índice parcial, se mantiene diminuto solo.
CREATE INDEX IF NOT EXISTS deploy_runs_en_curso_idx
  ON public.deploy_runs (started_at DESC)
  WHERE finished_at IS NULL;

CREATE INDEX IF NOT EXISTS deploy_runs_reciente_idx
  ON public.deploy_runs (started_at DESC);

COMMENT ON TABLE public.deploy_runs IS
  'Despliegues lanzados: para poder ver que otra sesión ya está desplegando SIN competir por el lock (T-404).';
COMMENT ON COLUMN public.deploy_runs.pid IS
  'PID del lanzador. Si el lector está en el mismo host puede comprobar si vive: exacto, en vez de deducirlo por antigüedad.';
