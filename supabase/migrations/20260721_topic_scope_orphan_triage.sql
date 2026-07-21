-- T-055 — Tracking durable del triaje de leyes huérfanas (sin topic_scope).
--
-- Problema: al recolocar leyes huérfanas en su tema (por epígrafe), muchas se
-- decide DEJARLAS SIN COLOCAR (materia fuera del temario, ambigua, anual/caduca…).
-- Esa decisión "held" solo vivía en prosa del backlog → cada nueva pasada (o cada
-- sesión) volvía a examinar las MISMAS leyes ya descartadas. Desperdicio y riesgo
-- de re-hacer/contradecir el juicio anterior.
--
-- Solución: registrar CADA decisión de triaje. Las COLOCADAS ya se auto-trackean
-- (están en topic_scope → no reaparecen como huérfanas). Esta tabla guarda sobre
-- todo las HELD para poder EXCLUIRLAS de la cola: la próxima pasada solo mira las
-- huérfanas que NADIE ha triado aún para esa oposición.
--
-- Clave (law_id, position_type): una misma ley puede colocarse en una oposición y
-- quedar held en otra (el epígrafe manda por oposición).

CREATE TABLE IF NOT EXISTS public.topic_scope_orphan_triage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id        uuid NOT NULL REFERENCES public.laws(id) ON DELETE CASCADE,
  position_type text NOT NULL,                    -- oposición en cuyo contexto se triaja
  decision      text NOT NULL CHECK (decision IN ('placed','held')),
  topic_id      uuid REFERENCES public.topics(id) ON DELETE SET NULL,  -- si placed
  reason        text,                             -- si held, por qué (materia fuera de epígrafe, etc.)
  method        text,                             -- 'verify_scope_consensus' | 'manual_audited' | 'audit_reverted'
  triaged_at    timestamptz NOT NULL DEFAULT now(),
  triaged_by    text,
  CONSTRAINT topic_scope_orphan_triage_uq UNIQUE (law_id, position_type)
);

COMMENT ON TABLE public.topic_scope_orphan_triage IS
  'Triaje de leyes huérfanas (T-055). decision=held marca las descartadas para NO re-examinarlas; '
  'las placed ya viven en topic_scope. Clave por (law_id, position_type).';

CREATE INDEX IF NOT EXISTS idx_orphan_triage_held
  ON public.topic_scope_orphan_triage (position_type) WHERE decision = 'held';
