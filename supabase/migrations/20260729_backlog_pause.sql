-- T-210 (derivada) — el aplazamiento deja de ser un aviso y pasa a ser una condición.
--
-- La migración de ayer (20260728_backlog_snooze.sql) añadió el reloj y lo dejó a propósito como
-- AVISO: «claim no lo impide, solo avisa — a veces sí quieres adelantar el trabajo preparatorio».
-- El razonamiento era bueno; el resultado, medido 24 h después, no:
--
--   · T-221 SIGUE con "⛔ NO COGER HASTA EL 29/07 07:00 UTC" EN EL TÍTULO — o sea, ni con el
--     campo disponible se confió en el aviso. Y esa fecha YA PASÓ, así que hoy el título miente.
--   · T-234 hace lo mismo con "⏱ MEDIR EL 11/08".
--
-- Un aviso impreso en medio de la salida de `claim` es un aviso que nadie lee. Las colas de
-- trabajo serias (SQS DelaySeconds, scheduled sets de Sidekiq, ETA de Celery, colas sobre
-- Postgres con run_at) resuelven esto igual desde hace décadas: **un trabajo aplazado no se
-- avisa, no se ve**. La condición temporal vive en la consulta que reparte, no en la disciplina
-- de quien coge. El caso legítimo que defendía el aviso (adelantar preparación) no se pierde:
-- pasa a ser un acto explícito y REGISTRADO (`claim --force --motivo "…"`).
--
-- Y añade la operación que faltaba: aplazar una tarea que YA has empezado sin perder dónde la
-- dejaste. Hoy las dos salidas son malas — `release` borra que estaba a medias, y `snooze`
-- conservando el claim deja el lease muriéndose solo (medido: 3 tareas in_progress con el lease
-- caducado, una desde hace 32 h).
ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS snooze_count       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_note      text,
  ADD COLUMN IF NOT EXISTS resume_check       text,
  ADD COLUMN IF NOT EXISTS force_claim_reason text,
  ADD COLUMN IF NOT EXISTS force_claimed_at   timestamptz;

COMMENT ON COLUMN public.backlog_tasks.snooze_count IS
  'Cuántas veces se ha aplazado. Una tarea aplazada 5 veces no está programada: es una decisión que nadie toma. A partir del umbral, `list` la saca a triaje.';
COMMENT ON COLUMN public.backlog_tasks.progress_note IS
  'Al pausar: qué se dejó HECHO. Sin esto, quien la coja al despertar empieza de cero aunque no lo esté.';
COMMENT ON COLUMN public.backlog_tasks.resume_check IS
  'Al pausar: qué hay que VERIFICAR al despertar. Es el motivo de que la tarea siga viva.';
COMMENT ON COLUMN public.backlog_tasks.force_claim_reason IS
  'Motivo de haber cogido una tarea aplazada o bloqueada saltándose la condición. Registrado a propósito: el escape existe, pero deja rastro.';

-- ── Esperar a un DEPLOY no es esperar a un reloj ─────────────────────────────
-- El caso más común de "hecho pero sin verificar" no tiene fecha: el trabajo está en `main` y
-- solo se puede comprobar cuando alguien despliegue. Con `pause --hasta <fecha>` habría que
-- INVENTARSE una hora: si te quedas corto, la tarea despierta y sigue sin poder verificarse; si
-- te pasas, duerme de más. Es una CONDICIÓN, no un reloj.
--
-- Y es una condición que este repo sí sabe evaluar: `/api/health` publica el sha desplegado
-- (`deploy`) y git sabe si un commit está contenido en él. Así que se guarda el commit y se
-- despierta cuando ese commit esté vivo — lo avisa el propio deploy al terminar, y si nadie lo
-- avisa, `list` lo resuelve solo.
ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS wake_on_deploy_sha     text,
  ADD COLUMN IF NOT EXISTS wake_on_deploy_surface text;

COMMENT ON COLUMN public.backlog_tasks.wake_on_deploy_sha IS
  'Commit que tiene que estar DESPLEGADO para poder verificar la tarea. NULL = nada que esperar. Lo limpia `backlog.cjs deployed <sha>` (lo llama el propio script de deploy).';
COMMENT ON COLUMN public.backlog_tasks.wake_on_deploy_surface IS
  'frontend | backend | both — qué superficie hay que mirar. El backend y el frontend se despliegan por separado y una tarea puede necesitar solo una.';
