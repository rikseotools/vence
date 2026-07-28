-- 20260728_reward_impugnacion.sql
-- Nueva fuente de recompensa: 1 € por IMPUGNACIÓN ACEPTADA a favor del usuario (decisión Manuel 28/07).
--
-- Por qué así:
--  · `reward_submissions.type` tenía un CHECK cerrado a ('bug','ugc') → hay que abrirlo a 'impugnacion'.
--    Se mantiene CERRADO (taxonomía explícita) en vez de quitarlo: es el guardarraíl que impide que un
--    typo cree una fuente fantasma que luego pagamos.
--  · `dispute_id` es el MOTIVO de esta recompensa, igual que `feedback_id` lo es en 'bug' y `url` en 'ugc'.
--    Sin él, el anti-duplicado por motivo no puede existir y la misma impugnación se pagaría dos veces.
--  · SIN FK a `question_disputes`: la impugnación puede vivir en `question_disputes` (legislativa) o en
--    `psychometric_question_disputes` (psicotécnica), y una FK solo puede apuntar a una tabla. El índice
--    parcial único hace el trabajo real (impedir el doble pago); la integridad referencial la garantiza
--    el código, que solo escribe con un id que acaba de leer.
--
-- Additiva y reversible: no toca datos existentes.

ALTER TABLE public.reward_submissions
  DROP CONSTRAINT IF EXISTS reward_submissions_type_check;

ALTER TABLE public.reward_submissions
  ADD CONSTRAINT reward_submissions_type_check
  CHECK (type = ANY (ARRAY['bug'::text, 'ugc'::text, 'impugnacion'::text]));

ALTER TABLE public.reward_submissions
  ADD COLUMN IF NOT EXISTS dispute_id uuid;

COMMENT ON COLUMN public.reward_submissions.dispute_id IS
  'Impugnación que originó la recompensa (type=''impugnacion''). Motivo trazable + clave anti-duplicado. Sin FK: puede ser legislativa o psicotécnica.';

-- Anti-duplicado FÍSICO: una impugnación no puede generar dos recompensas vivas.
-- Parcial sobre no-rejected para que anular una (status='rejected') permita re-emitirla si hiciera falta.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reward_submissions_dispute_alive
  ON public.reward_submissions (dispute_id)
  WHERE dispute_id IS NOT NULL AND status <> 'rejected';
