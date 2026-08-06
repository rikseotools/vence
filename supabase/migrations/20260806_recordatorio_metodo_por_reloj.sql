-- ═══════════════════════════════════════════════════════════════════════════════════════════
-- El recordatorio de método, POR RELOJ y sin depender de que nadie se acuerde. (T-486, 06/08)
--
-- ── POR QUÉ ─────────────────────────────────────────────────────────────────────────────────
-- Orden de Manuel: «las frases no solo deben saltar en cada tarea, también de forma cada x
-- minutos para que no se le olviden».
--
-- Los tres canales que ya había NO cubren a un trabajador autónomo que encadena tareas:
--   · el hook `UserPromptSubmit` (cada 15 mensajes) necesita PROMPTS, y un `claude -p` no tiene;
--   · el `pre-commit` solo dispara al estrenar ficheros, que puede no pasar en horas;
--   · `heartbeat` sí lo imprime… pero exige que el trabajador se acuerde de lanzarlo, y confiar
--     en que se acuerde es exactamente lo que falla — es el mismo error que la instrucción
--     «lee el manual entero antes de cada tarea», que nadie hace.
--
-- Así que se ancla al RELOJ del servidor y se comprueba en cada comando del andamiaje: mientras
-- un turno encadena, pasa por el CLI constantemente, así que la cadencia sale sola sin pedirle
-- nada al modelo. El estado va aquí y no en un fichero porque un trabajador vive en otra máquina
-- y su turno muere: lo único que sobrevive entre turnos es la base de datos.
--
-- Aditiva y sin defecto: NULL = «nunca se le ha recordado», que dispara en el primer comando.
-- ═══════════════════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.worktree_sessions
  ADD COLUMN IF NOT EXISTS last_method_reminder_at timestamptz;

COMMENT ON COLUMN public.worktree_sessions.last_method_reminder_at IS
  'Cuándo se le imprimió por última vez el recordatorio de método (lib/sessions/recordatorio.cjs → METODO). '
  'Lo estampa el propio CLI al imprimirlo. NULL = nunca. Sirve para la cadencia por reloj de T-486: '
  'un trabajador autónomo no tiene hook de prompts ni se acuerda de lanzar heartbeat.';
