-- Memoria de "timeline revisado sin novedad" para el sensor timeline_silence (modo agotado).
--
-- El sensor de "timeline AGOTADO" (T-059) detecta oposiciones sin fecha de examen que llevan
-- semanas sin un hito nuevo. Sin memoria, al encenderlo re-avisaría cada noche de las mismas
-- oposiciones ya revisadas sin novedad → una bandeja que grita se aprende a ignorar (el error
-- por el que murió hash_change).
--
-- Esta columna sella CUÁNDO se revisó por última vez el timeline de una oposición y se
-- confirmó que no había novedad. El sensor NO vuelve a emitir mientras el último hito sea
-- anterior a esa revisión; solo re-emite cuando aparece un hito NUEVO (posterior a la
-- revisión), que es una situación genuinamente nueva que merece mirarse.
--
-- Additiva y reversible. NULL = nunca revisado (candidata si cumple el resto de condiciones).
ALTER TABLE public.oposiciones
  ADD COLUMN IF NOT EXISTS timeline_reviewed_at timestamptz;

COMMENT ON COLUMN public.oposiciones.timeline_reviewed_at IS
  'Última vez que se revisó el timeline y se confirmó sin novedad (sensor timeline_silence modo agotado, T-059). El sensor no re-avisa mientras el último hito sea anterior a esta fecha.';
