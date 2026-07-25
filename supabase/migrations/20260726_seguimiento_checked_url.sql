-- Registrar QUÉ URL se comprobó en cada pasada del cron de seguimiento.
--
-- Origen 26/07/2026 (T-125, cabo de T-114): el detector de "fuentes ciegas" clasifica una
-- `seguimiento_url` a partir del contenido del último check (`content_preview`). Pero el historial
-- NO guardaba la URL comprobada, así que tras repuntar una oposición la evidencia del check viejo
-- se atribuía a la URL nueva → **falso positivo garantizado**. Lo cazó la simulación bank-wide el
-- mismo día: `administrativo-diputacion-jaen` se repuntó a una ficha servida en HTML plano y aun
-- así salía marcada como ciega, con el contenido de la SPA anterior.
--
-- Además de arreglar eso, hace AUDITABLE el historial: hasta ahora no había forma de saber qué
-- estábamos vigilando de verdad en una fecha dada.
--
-- Nullable a propósito: las filas anteriores a esta migración no tienen forma de saberlo. El
-- detector trata `checked_url IS NULL` como "evidencia no atribuible" y NO marca (fail-safe:
-- preferimos perder un hallazgo a inventarlo). Se auto-cura en la primera pasada del cron.
--
-- IF NOT EXISTS: idempotente.

ALTER TABLE public.convocatoria_seguimiento_checks
  ADD COLUMN IF NOT EXISTS checked_url text;

COMMENT ON COLUMN public.convocatoria_seguimiento_checks.checked_url IS
  'URL realmente comprobada en esta pasada. NULL en filas anteriores al 26/07/2026. El detector de fuentes ciegas solo usa evidencia cuya checked_url coincide con oposiciones.seguimiento_url; si no coincide (repunte posterior) o es NULL, la ignora.';

-- Índice parcial: la consulta del detector busca el último check ATRIBUIBLE por oposición.
CREATE INDEX IF NOT EXISTS idx_seguimiento_checks_oposicion_url
  ON public.convocatoria_seguimiento_checks (oposicion_id, checked_at DESC)
  WHERE checked_url IS NOT NULL;

-- Backfill CONSERVADOR de la evidencia histórica.
--
-- `oposiciones.seguimiento_last_hash` guarda el hash del último check con éxito de la URL VIGENTE.
-- Si una fila del historial tiene ese mismo `content_hash`, esa fila se tomó necesariamente de la
-- URL vigente → es atribuible. Si la URL se repuntó después, el procedimiento de repunte pone el
-- hash a NULL (ver runbook), así que no hay coincidencia y la fila se queda sin atribuir, que es
-- justo lo que queremos. Sin heurísticas de fecha: o el hash casa, o no se atribuye.
UPDATE public.convocatoria_seguimiento_checks c
   SET checked_url = o.seguimiento_url
  FROM public.oposiciones o
 WHERE c.oposicion_id = o.id
   AND c.checked_url IS NULL
   AND o.seguimiento_last_hash IS NOT NULL
   AND c.content_hash = o.seguimiento_last_hash;
