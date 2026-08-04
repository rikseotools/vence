-- T-539 — El latido dice QUÉ es la sesión, no solo quién y dónde.
--
-- ── POR QUÉ ──────────────────────────────────────────────────────────────────────────────────
-- `worktree_sessions` contesta «quién da señal» (sid), «dónde» (worktree_path) y desde [T-484]
-- «en qué máquina» (host). Con trabajadores autónomos en la flota falta el dato que cambia cómo
-- se lee todo lo demás: **si esa sesión es una persona o un trabajador**.
--
-- Sin él, el parte no puede distinguir dos cosas que se ven idénticas y no lo son:
--   · una PERSONA que no ha corrido el preflight  → normal, no pasa nada;
--   · un TRABAJADOR que no ha corrido el preflight → está trabajando sin que nadie sepa si puede.
--
-- Es exactamente la distinción que la pieza 3 de [T-539] necesita para no dar «verde porque estoy
-- ciego» por «verde porque lo comprobé».
--
-- NULL = no se sabe, y se lee como persona. Las sesiones vivas de ahora mismo tienen la columna
-- vacía y NO se rellena a ojo: un dato inventado en la fila de una sesión ajena es peor que el
-- hueco, porque el hueco se ve.
--
-- Lo escribe `scripts/sessions/latir.cjs`, que es el escritor ÚNICO de esta tabla (registro de
-- herramientas). Idempotente.

ALTER TABLE public.worktree_sessions
  ADD COLUMN IF NOT EXISTS rol text;

COMMENT ON COLUMN public.worktree_sessions.rol IS
  'T-539 — «persona» | «trabajador». NULL = no declarado (se lee como persona). Lo escribe latir.cjs desde VENCE_SESSION_ROLE, que declara quien ARRANCA la sesión, no la sesión.';

-- Cerrado a propósito: un catálogo abierto acaba siendo texto libre que nadie puede agregar, y
-- este dato decide si un guardarraíl bloquea o avisa.
ALTER TABLE public.worktree_sessions
  DROP CONSTRAINT IF EXISTS worktree_sessions_rol_check;
ALTER TABLE public.worktree_sessions
  ADD CONSTRAINT worktree_sessions_rol_check
  CHECK (rol IS NULL OR rol IN ('persona', 'trabajador'));
