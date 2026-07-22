-- Adjudicaciones Stage-2 de SOBRE-INCLUSIÓN de topic_scope.
--
-- Contexto: el detector determinista (lib/laws/scopeOverInclusion.ts) es Stage-1,
-- alta RECALL: saca ~90 sospechosos (5 HIGH + 85 MEDIUM). La banda MEDIUM (donde
-- cae el caso raíz T11 de la Ley 3/2009) tiene precisión ~35% → NO puede pingar el
-- badge sola. El Stage-2 (workflow adjudicar-sobre-inclusion: mapea epígrafe→estructura
-- oficial de la ley, lista los títulos escopados que el epígrafe NO nombra, con
-- verificación adversarial) convierte cada sospechoso en over_inclusion | ok |
-- unverifiable. Esta tabla PERSISTE ese veredicto para:
--   - ESCALA: solo re-adjudicar lo que CAMBIÓ. content_hash = md5(epígrafe + scope);
--     si el hash actual != el guardado (o no hay fila) → re-adjudicar. Como el patrón
--     de topic_scope_orphan_triage (T-055): no re-examinar lo ya decidido.
--   - OBSERVABILIDAD: los verdict='over_inclusion' verificados = cola accionable real
--     (recorte de scope), sin el ruido del 65% de falsos positivos del MEDIUM crudo.
--   - PROFESIONAL: registro durable con provenance (quién/cuándo/método), no un informe efímero.
--
-- NUNCA se auto-aplica el recorte: esta tabla es el DIAGNÓSTICO; el recorte de
-- article_numbers lo confirma un humano (regla de la casa).
--
-- Clave (topic_id, law_id): un veredicto vigente por par tema-ley. Re-adjudicar = upsert.

CREATE TABLE IF NOT EXISTS public.scope_over_inclusion_adjudications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          uuid NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  law_id            uuid NOT NULL REFERENCES public.laws(id) ON DELETE CASCADE,
  content_hash      text NOT NULL,                 -- md5(epígrafe + scope ordenado) al adjudicar
  band              text,                          -- HIGH | MEDIUM (Stage-1 en el momento)
  verdict           text NOT NULL CHECK (verdict IN ('over_inclusion','ok','unverifiable')),
  titulos_excluidos jsonb,                         -- títulos que el epígrafe NO nombra pero el scope escopa
  arts_correctos    text,                          -- rango de arts que el epígrafe implica (si over_inclusion)
  razon             text,
  verificado        boolean NOT NULL DEFAULT false,-- pasó la verificación adversarial (2º agente)
  method            text,                          -- p.ej. 'workflow:adjudicar-sobre-inclusion'
  adjudicado_at     timestamptz NOT NULL DEFAULT now(),
  adjudicado_por    text,
  CONSTRAINT scope_oi_adj_uq UNIQUE (topic_id, law_id)
);

COMMENT ON TABLE public.scope_over_inclusion_adjudications IS
  'Stage-2 de la detección de sobre-inclusión de scope. Persiste el veredicto del adjudicador '
  '(over_inclusion|ok|unverifiable) por (topic_id, law_id) con content_hash para re-adjudicar solo lo '
  'que cambió. Los over_inclusion verificados = cola de recorte accionable (humano confirma, no auto).';

-- Cola accionable: over-inclusiones confirmadas pendientes de recorte.
CREATE INDEX IF NOT EXISTS idx_scope_oi_confirmed
  ON public.scope_over_inclusion_adjudications (adjudicado_at)
  WHERE verdict = 'over_inclusion' AND verificado = true;
