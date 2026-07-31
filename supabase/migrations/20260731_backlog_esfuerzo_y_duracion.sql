-- T-414 — cuánto CUESTA de verdad una tarea, y cuánto dijimos que costaría.
--
-- ── LO QUE FALTABA, Y EN QUÉ ORDEN ───────────────────────────────────────────────────────────
-- Encargo de Manuel: que la ficha declare esfuerzo y plazo, para triar mejor. El plazo YA existía
-- (`due_at`/`due_reason`, y solo 1 de 182 tareas abiertas lo usa — que es lo correcto: un CHECK
-- exige motivo EXTERNO justo para que no se inventen). El esfuerzo no existía.
--
-- Pero al ir a añadirlo salió algo que lo cambia todo: **hoy hay CERO tareas con duración
-- medible**, porque al cerrar (`done`), al soltar (`release`) y al pausar (`pause`) se ponía
-- `claimed_at = NULL` — o sea, se BORRA el único dato que permitiría contrastar una estimación.
--
-- Sin esto, una estimación de esfuerzo sería incontrastable PARA SIEMPRE: dentro de tres meses
-- nadie podría decir si los cajones significan algo, y el campo moriría como mueren todos los
-- campos que nadie puede desmentir. Por eso la duración va PRIMERO y la estimación después.
--
-- ── POR QUÉ TIEMPO ACUMULADO Y NO `closed_at - created_at` ───────────────────────────────────
-- El tiempo de PARED miente: una tarea abierta el 19/07 y cerrada el 31/07 no costó doce días,
-- estuvo esperando. Lo que se acumula aquí es solo el rato en que alguien la tenía reclamada de
-- verdad — sumando los tramos, porque una tarea se coge y se suelta varias veces.

ALTER TABLE public.backlog_tasks
  -- Cuándo se empezó a trabajar por primera vez (lead time real, para distinguir «costó mucho»
  -- de «estuvo mucho tiempo esperando a que alguien la cogiera»).
  ADD COLUMN IF NOT EXISTS first_claimed_at timestamptz,
  -- Segundos ACUMULADOS con la tarea reclamada. Se suma al soltar/pausar/cerrar.
  ADD COLUMN IF NOT EXISTS worked_seconds   integer NOT NULL DEFAULT 0,
  -- Esfuerzo DECLARADO, en cajones gruesos. Nada de horas: una estimación en horas se convierte
  -- en ficción («2h» para todo) y envejece sola, igual que las fechas escritas en los títulos.
  -- La frontera que de verdad cambia una decisión es la última: ¿lo encajo al final de esta
  -- sesión, o necesita una entera?
  ADD COLUMN IF NOT EXISTS effort           text;

ALTER TABLE public.backlog_tasks
  DROP CONSTRAINT IF EXISTS backlog_effort_valido;
ALTER TABLE public.backlog_tasks
  ADD CONSTRAINT backlog_effort_valido
  CHECK (effort IS NULL OR effort IN ('minutos', 'rato', 'larga', 'sesion_propia'));

COMMENT ON COLUMN public.backlog_tasks.worked_seconds IS
  'Segundos acumulados con la tarea reclamada (T-414). NO es closed_at-created_at: eso mide espera, no esfuerzo.';
COMMENT ON COLUMN public.backlog_tasks.effort IS
  'Esfuerzo declarado en cajones: minutos | rato | larga | sesion_propia. Contrastable contra worked_seconds.';
COMMENT ON COLUMN public.backlog_tasks.first_claimed_at IS
  'Primera vez que alguien la cogió: separa «costó mucho» de «esperó mucho».';
