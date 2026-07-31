-- T-400 — la HUELLA de cada sesión: qué ficheros está tocando ahora mismo.
--
-- El claim (`backlog_tasks`) impide que dos sesiones cojan la MISMA tarea. No impide que cojan
-- tareas DISTINTAS que tocan los mismos ficheros, que es como chocan de verdad. Casos medidos en
-- el propio repo: T-361 («lo encontraron DOS sesiones a la vez», cada una arreglando una mitad),
-- T-130 (un QUINTO escritor de `seguimiento_url` escrito sin ver los otros cuatro) y, el 31/07,
-- T-375 y T-382 cogidas por separado resultando ser los MISMOS ficheros.
--
-- Se guarda lo que la sesión toca DE VERDAD (sucio + commits sin pushear, sacado de git), no lo
-- que declare: la intención declarada se pudre en cuanto el trabajo se desvía, el estado
-- observado no. Y por eso lo escribe el latido, que ya existe y ya corre en cada comando de
-- `backlog.cjs` y en cada `pre-push` — sin pedirle disciplina a nadie.
--
-- Additiva y con DEFAULT nulo: una sesión con la versión vieja del script sigue latiendo igual,
-- solo que sin huella (y quien lee lo trata como "no sé", nunca como "no toca nada").

ALTER TABLE public.worktree_sessions
  ADD COLUMN IF NOT EXISTS touched_files text[],
  ADD COLUMN IF NOT EXISTS touched_at    timestamptz;

COMMENT ON COLUMN public.worktree_sessions.touched_files IS
  'Ficheros que esta sesión tiene sucios o en commits sin pushear (T-400). Derivado de git, no declarado.';
COMMENT ON COLUMN public.worktree_sessions.touched_at IS
  'Cuándo se calculó la huella. Si es viejo respecto a last_signal_at, la huella es de una versión sin soporte.';
