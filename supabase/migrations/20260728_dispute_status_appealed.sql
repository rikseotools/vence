-- 20260728_dispute_status_appealed.sql
-- El estado `appealed` NUNCA existió en la base de datos, aunque medio sistema lo daba por hecho.
--
-- Qué estaba roto (28/07/2026, destapado al resolver la impugnación `212abcda`):
--  · El CHECK de `status` admite solo ('pending','reviewing','resolved','rejected'). En 1.887 filas
--    NO hay ni un solo `appealed` en toda la historia: era imposible escribirlo.
--  · `/api/v2/disputes/appeal` hace `SET status='appealed'` → **falla siempre** contra el CHECK.
--  · El camino que SÍ funciona (`/api/dispute` PATCH → `handleDisputeAppeal`) escribe `status='pending'`,
--    así que la alegación de un usuario vuelve a la cola **indistinguible de una impugnación nueva**:
--    quien la coge no ve que ya se le respondió, y al cerrarla le manda un SEGUNDO correo. Casi pasa.
--  · El panel de admin (`app/admin/impugnaciones`) pinta el texto de la alegación solo
--    `if (dispute.status === 'appealed')` → llevaba desde siempre sin enseñarlo.
--
-- Medido antes de tocar: 410 filas con `appeal_text`, de las cuales **29 son alegaciones reales**
-- (el resto es el texto automático "Usuario de acuerdo con la respuesta del administrador"), y de
-- esas **3 se quedaron sin respuesta posterior**.
--
-- Se mantiene el CHECK CERRADO en vez de quitarlo: es lo que impide que un typo invente un estado
-- fantasma que nadie atiende — que es exactamente el fallo que esta migración viene a cerrar.
--
-- Additiva y reversible: solo AMPLÍA los valores permitidos, no toca ninguna fila.

ALTER TABLE public.question_disputes
  DROP CONSTRAINT IF EXISTS question_disputes_status_check;

ALTER TABLE public.question_disputes
  ADD CONSTRAINT question_disputes_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'rejected'::text, 'appealed'::text]));

-- Las psicotécnicas NO tienen alegación (la tabla ni siquiera tiene `appeal_text`), pero se alinea el
-- dominio para que el día que se añada no repita esta historia: un estado que el código usa y la BD
-- rechaza en silencio.
ALTER TABLE public.psychometric_question_disputes
  DROP CONSTRAINT IF EXISTS psychometric_question_disputes_status_check;

ALTER TABLE public.psychometric_question_disputes
  ADD CONSTRAINT psychometric_question_disputes_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'reviewing'::text, 'resolved'::text, 'rejected'::text, 'appealed'::text]));
