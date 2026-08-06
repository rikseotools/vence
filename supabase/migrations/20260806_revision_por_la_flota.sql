-- T-486 — el escalón «entregada → revisada» pasa a tener quien lo mueva.
--
-- Medido el 06/08: de los seis escalones del ciclo de una tarea, cinco avanzan solos (el
-- supervisor reparte, el trabajador entrega, el deploy despierta, el reloj suelta) y UNO no tenía
-- mecanismo ninguno: `entregada → revisada` esperaba a que alguien decidiera mirar. Resultado: 23
-- entregas paradas, 15 h de media, la más vieja 41 h. No era una cola lenta, era una cola sin
-- salida.
--
-- Revisar es trabajo TÉCNICO —leer el diff, comprobar que lo afirmado es cierto, correr los
-- tests— así que lo puede hacer otro trabajador. Lo que NO se delega es meterlo en `main`: eso
-- sigue siendo de una persona, porque al juntar ramas aparecen choques entre trabajos paralelos
-- que ninguna rama ve por separado (06/08: un guardarraíl de paridad roto, una colisión de
-- migraciones y tres arreglos duplicados).

ALTER TABLE public.backlog_tasks
  ADD COLUMN IF NOT EXISTS reviewed_at    timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by    text,
  ADD COLUMN IF NOT EXISTS review_verdict text,
  ADD COLUMN IF NOT EXISTS review_findings text;

-- El veredicto es cerrado a propósito: «ok» o «problemas». Un campo libre se llena de matices
-- («ok pero…») y entonces nadie sabe si se puede mergear, que es la única pregunta que importa.
ALTER TABLE public.backlog_tasks DROP CONSTRAINT IF EXISTS backlog_review_verdict_check;
ALTER TABLE public.backlog_tasks ADD CONSTRAINT backlog_review_verdict_check
  CHECK (review_verdict IS NULL OR review_verdict IN ('ok', 'problemas'));

-- Un veredicto sin hallazgos no es una revisión, es un sello. Se exige texto, y para «problemas»
-- se exige más: quien lo recibe tiene que poder arreglarlo sin volver a investigarlo entero.
ALTER TABLE public.backlog_tasks DROP CONSTRAINT IF EXISTS backlog_review_findings_check;
ALTER TABLE public.backlog_tasks ADD CONSTRAINT backlog_review_findings_check
  CHECK (
    review_verdict IS NULL
    OR (review_verdict = 'ok'        AND length(coalesce(review_findings, '')) >= 30)
    OR (review_verdict = 'problemas' AND length(coalesce(review_findings, '')) >= 60)
  );

-- NADIE REVISA LO SUYO. Es la propiedad que hace que la revisión valga algo: quien escribió el
-- código ya se convenció una vez, y volver a mirarlo no añade información.
ALTER TABLE public.backlog_tasks DROP CONSTRAINT IF EXISTS backlog_no_autorevision_check;
ALTER TABLE public.backlog_tasks ADD CONSTRAINT backlog_no_autorevision_check
  CHECK (reviewed_by IS NULL OR review_requested_by IS NULL OR reviewed_by <> review_requested_by);

CREATE INDEX IF NOT EXISTS backlog_pendientes_de_revisar_idx
  ON public.backlog_tasks (review_requested_at)
  WHERE review_requested_at IS NOT NULL AND reviewed_at IS NULL;
