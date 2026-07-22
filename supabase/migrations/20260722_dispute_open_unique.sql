-- 20260722_dispute_open_unique.sql
--
-- Bug (María José, 22/07): al pulsar "Impugnar" su móvil envió 5 POST idénticos en 44 ms
-- (multi-tap; el botón no se bloqueaba). createDispute hace "SELECT ¿existe? → INSERT": las 5
-- peticiones pasaron el SELECT antes de que ninguna hiciera commit (race) y, al NO existir la
-- constraint UNIQUE que el código YA esperaba (question_disputes_question_id_user_id_key, nunca
-- creada), las 5 se insertaron → 5 impugnaciones duplicadas ("se me ha cuadruplicado").
--
-- Fix de fondo: índice único PARCIAL "una impugnación ABIERTA (pending/reviewing) por
-- (pregunta, usuario)". La BD rechaza la ráfaga en el origen (gana el primero; los demás → 23505,
-- que el server maneja idempotente). NO bloquea re-impugnar tras resolución (resolved/rejected NO
-- están cubiertos por el índice) → el usuario puede volver a impugnar la misma pregunta más tarde.
-- Guardarraíl anti-regresión: __tests__/guardrails/disputeOpenUnique.test.ts verifica que el índice existe.

-- 1) Dedup de las ráfagas accidentales: conservar la impugnación ABIERTA más antigua por
--    (question_id, user_id); borrar las copias idénticas posteriores. Solo afecta a filas con >1
--    abierta (hoy: solo el grupo de María José, 5→1). Las cerradas/legítimas no se tocan.
DELETE FROM question_disputes qd
USING (
  SELECT id,
         row_number() OVER (PARTITION BY question_id, user_id ORDER BY created_at, id) AS rn
  FROM question_disputes
  WHERE status IN ('pending', 'reviewing') AND question_id IS NOT NULL
) dup
WHERE qd.id = dup.id AND dup.rn > 1;

-- 2) Índice único parcial: máximo UNA impugnación abierta por (pregunta, usuario).
CREATE UNIQUE INDEX IF NOT EXISTS question_disputes_open_uq
  ON question_disputes (question_id, user_id)
  WHERE status IN ('pending', 'reviewing');

-- 3) Mismo blindaje para las psicotécnicas (mismo patrón de creación, mismo riesgo).
CREATE UNIQUE INDEX IF NOT EXISTS psychometric_question_disputes_open_uq
  ON psychometric_question_disputes (question_id, user_id)
  WHERE status IN ('pending', 'reviewing');
