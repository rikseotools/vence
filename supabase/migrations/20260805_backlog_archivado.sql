-- T-392 (Fase 2+3) — El último escalón del ciclo: `done` ≠ archivada.
--
-- ── POR QUÉ ──────────────────────────────────────────────────────────────────────────────────
-- La Fase 1 (31/07) ya impide cerrar una tarea cuyo código servido no está desplegado todavía
-- (`lib/backlog/verificacionGate.cjs`). Pero eso solo comprueba que el commit está VIVO, no que
-- alguien lo haya visto FUNCIONAR — que es la mitad del encargo original de Manuel: *"la última
-- fase la verificación en producción, y cuando está verificada y todo correcto ponerle estado
-- archivado"*. Hoy `done` es terminal: cierra la tarea y ahí se pierde la distinción entre "el
-- deploy ya incluye el commit" (lo que Fase 1 comprueba) y "alguien miró producción y funciona"
-- (lo que Manuel pidió).
--
-- ── POR QUÉ SON COLUMNAS NUEVAS Y NO UN `status` NUEVO ─────────────────────────────────────────
-- La ficha original dibuja `verificando`/`lista_para_verificar`/`archivada` como valores de
-- `status`. Se descarta a propósito: `status` lo leen decenas de `WHERE status IN (...)` a lo
-- largo de backlog.cjs (claim, next, sync, el guardarraíl de CI que exige mover la ficha a
-- "## Hechas" cuando status='done'…), y además el ciclo real YA existe repartido en otras
-- columnas — `pause --tras-deploy`/`--hasta` + `resume_check` YA modelan "verificando", y el
-- cubo «⏰ IMPLEMENTADAS Y SIN COMPROBAR» de `list` YA es "lista_para_verificar", solo que para
-- tareas que TODAVÍA no se cerraron. Lo único que falta es el escalón DESPUÉS de `done`: por eso
-- esto es aditivo sobre 'done', no un estado más ancho. Menos superficie de cambio, cero riesgo
-- de romper un `WHERE status IN (...)` que alguien olvidó actualizar.
--
-- ── LAS TRES REGLAS QUE LO SALVAN DE SER UN SELLO (de la propia ficha) ─────────────────────────
--   1. Exención automática: si la tarea no toca superficie servida (`requiere_archivo=false`),
--      `done` la archiva sola en el mismo golpe — no hay nada que "ver funcionar en producción".
--   2. Archivar exige EVIDENCIA (>=20 caracteres, vocabulario no vacío), igual que `review_note`
--      y `due_reason`: se hace cumplir con un CHECK, no solo en el CLI.
--   3. El cubo de "cerradas sin archivar" sale en `list`, con la misma antigüedad que ya usa
--      `isChronicSnooze` para no dejarlo invisible.
--
-- Aditiva y nullable: nada de lo que hay hoy cambia de comportamiento. Idempotente.

ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS archived_at       timestamptz,
  ADD COLUMN IF NOT EXISTS archive_evidence  text,
  ADD COLUMN IF NOT EXISTS archived_by       text,
  ADD COLUMN IF NOT EXISTS requiere_archivo  boolean;

COMMENT ON COLUMN public.backlog_tasks.archived_at IS
  'T-392 — cuándo se confirmó, con evidencia, que el trabajo funciona en producción. NULL = sin archivar.';
COMMENT ON COLUMN public.backlog_tasks.archive_evidence IS
  'T-392 — QUÉ se comprobó y con qué evidencia (no "ok"/"listo"). Obligatoria si archived_at está puesto.';
COMMENT ON COLUMN public.backlog_tasks.archived_by IS
  'T-392 — sid que archivó, o "migracion-t392"/"auto" para las que no pasaron por una persona.';
COMMENT ON COLUMN public.backlog_tasks.requiere_archivo IS
  'T-392 — ¿esta tarea, al cerrarse, tocaba superficie servida? true=hace falta `archive --evidencia` '
  'tras verla en producción; false=se archivó sola (docs/tooling, nada que ver funcionar); '
  'NULL=no se pudo determinar (fail-open) o es de antes de esta migración.';

-- Mismo patrón que `backlog_tasks_review_completo_check` / `backlog_tasks_due_con_motivo`: el
-- CLI puede saltarse su propia validación por un bug, la tabla no.
ALTER TABLE public.backlog_tasks
  DROP CONSTRAINT IF EXISTS backlog_tasks_archivo_coherente;
ALTER TABLE public.backlog_tasks
  ADD CONSTRAINT backlog_tasks_archivo_coherente
  CHECK (
    (archived_at IS NULL AND archive_evidence IS NULL)
    OR (archived_at IS NOT NULL AND archive_evidence IS NOT NULL AND length(btrim(archive_evidence)) >= 20)
  );

-- Se consulta por «¿qué está cerrada y sin archivar?», que es una lista corta sobre una tabla que
-- crece: índice parcial, igual que `idx_backlog_tasks_esperando_revision`.
CREATE INDEX IF NOT EXISTS idx_backlog_tasks_pendiente_archivar
  ON public.backlog_tasks (closed_at)
  WHERE status = 'done' AND archived_at IS NULL AND requiere_archivo = true;
