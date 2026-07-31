-- T-430 — quién tuvo esta tarea la última vez, para poder RECUPERAR lo que dejó.
--
-- Cuando una sesión muere de golpe (se apaga el ordenador, se queda sin contexto, la cierran) no
-- llega a escribir el `--hecho`/`--falta` del `pause`: ese hueco solo se llena si la sesión tiene
-- la oportunidad de despedirse, y justo las que mueren no la tienen.
--
-- Pero NO se pierde todo: su worktree conserva los ficheros sin commitear y, sobre todo, sus
-- COMMITS SIN PUSHEAR — cuyos mensajes son la mejor nota que existe, porque se escribieron cuando
-- esa sesión tenía todo el contexto y no costaron disciplina extra. Lo único que faltaba era
-- saber A QUIÉN preguntar: `claimed_by` se pone a NULL al soltar, pausar o segar.
--
-- Esta columna guarda ese rastro. No se pide nada nuevo a nadie: se escribe sola al reclamar.
ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS last_claimed_by text;

COMMENT ON COLUMN public.backlog_tasks.last_claimed_by IS
  'Última sesión que la tuvo, aunque ya la soltara (T-430). Permite recuperar su trabajo sin pushear al retomarla.';
