-- Verificación de convocatoria contra su documento oficial (fuente única de la verdad del PROCESO).
-- Calcado al patrón topic_epigrafe_verification (S2): estado + hash del dato PROPIO + hash de la
-- FUENTE externa + provenance (cláusula literal), auto-invalidación por trigger del dato propio,
-- drift contra la fuente derivado por VISTA (no trigger frágil), única vía de escritura = función,
-- historial append-only, y gate CI que caza filas verificadas cuyo hash ya no cuadra.
--
-- Verifica los campos de PROCESO de la convocatoria vigente (exam_date, plazas, estado, inscripción)
-- contra el documento oficial (bases). NUNCA auto-flip: un descuadre se revisa; la corrección la
-- aplica un humano/Claude vía record_convocatoria_verification + dual-write a convocatorias/oposiciones.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tabla de estado (1 fila por convocatoria)
CREATE TABLE IF NOT EXISTS public.convocatoria_verification (
  convocatoria_id      uuid PRIMARY KEY REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  state                text NOT NULL DEFAULT 'never_verified'
                         CHECK (state IN ('never_verified','verifying','verified_correct',
                                          'verified_issues','needs_human','stale')),
  verified_data_hash   text,          -- hash de los campos PROPIOS en el instante del veredicto
  verified_source_hash text,          -- content_hash del documento oficial en ese instante
  source_url           text,          -- URL del documento verificado (BOCM/BOE/sede)
  source_snippet       text,          -- cláusula LITERAL que respalda el veredicto (provenance durable)
  verdict              text CHECK (verdict IN ('correct','issues','needs_human')),
  findings             jsonb,         -- { exam_date:{db,oficial,cita,base}, plazas:{...}, ... }
  agent_run_id         text,
  verified_by          text,
  verified_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cv_state ON public.convocatoria_verification(state);

-- Historial append-only (fuente de verdad temporal; nunca UPDATE)
CREATE TABLE IF NOT EXISTS public.convocatoria_verification_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convocatoria_id      uuid NOT NULL REFERENCES public.convocatorias(id) ON DELETE CASCADE,
  state                text,
  data_hash            text,
  source_hash          text,
  source_url           text,
  verdict              text,
  findings             jsonb,
  agent_run_id         text,
  verified_by          text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cv_hist ON public.convocatoria_verification_history(convocatoria_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Hash determinista de los campos de PROCESO (calcado a compute_topic_scope_hash):
--    md5 + coalesce(...,'') en todo + separadores literales. Cualquier cambio en un campo
--    de proceso cambia el hash → el trigger invalida la verificación.
CREATE OR REPLACE FUNCTION public.compute_convocatoria_hash(p_convocatoria_id uuid)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT md5(
    coalesce((SELECT exam_date::text FROM public.convocatorias WHERE id = p_convocatoria_id), '') || '|' ||
    coalesce((SELECT exam_date_approximate::text FROM public.convocatorias WHERE id = p_convocatoria_id), '') || '|' ||
    coalesce((SELECT plazas_libres::text FROM public.convocatorias WHERE id = p_convocatoria_id), '') || '|' ||
    coalesce((SELECT plazas_promocion_interna::text FROM public.convocatorias WHERE id = p_convocatoria_id), '') || '|' ||
    coalesce((SELECT plazas_discapacidad::text FROM public.convocatorias WHERE id = p_convocatoria_id), '') || '|' ||
    coalesce((SELECT estado_proceso FROM public.convocatorias WHERE id = p_convocatoria_id), '') || '|' ||
    coalesce((SELECT inscription_start::text FROM public.convocatorias WHERE id = p_convocatoria_id), '') || '|' ||
    coalesce((SELECT inscription_deadline::text FROM public.convocatorias WHERE id = p_convocatoria_id), '')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Única vía de escritura: valida el verdict, captura el hash ACTUAL internamente
--    (el caller NO lo pasa → verified_data_hash siempre refleja el estado real), UPSERT
--    en estado + INSERT en historial. El hash de la fuente sí lo pasa el caller (viene del doc).
CREATE OR REPLACE FUNCTION public.record_convocatoria_verification(
  p_convocatoria_id uuid,
  p_verdict         text,           -- 'correct' | 'issues' | 'needs_human'
  p_findings        jsonb,
  p_source_url      text,
  p_source_snippet  text,
  p_source_hash     text,
  p_agent_run_id    text,
  p_verified_by     text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_hash  text;
  v_state text;
BEGIN
  IF p_verdict NOT IN ('correct','issues','needs_human') THEN
    RAISE EXCEPTION 'verdict inválido: %', p_verdict;
  END IF;
  v_hash := public.compute_convocatoria_hash(p_convocatoria_id);
  v_state := CASE p_verdict
               WHEN 'correct'      THEN 'verified_correct'
               WHEN 'issues'       THEN 'verified_issues'
               WHEN 'needs_human'  THEN 'needs_human'
             END;

  INSERT INTO public.convocatoria_verification AS cv (
    convocatoria_id, state, verified_data_hash, verified_source_hash, source_url,
    source_snippet, verdict, findings, agent_run_id, verified_by, verified_at, updated_at
  ) VALUES (
    p_convocatoria_id, v_state, v_hash, p_source_hash, p_source_url,
    p_source_snippet, p_verdict, p_findings, p_agent_run_id, p_verified_by, now(), now()
  )
  ON CONFLICT (convocatoria_id) DO UPDATE SET
    state = EXCLUDED.state, verified_data_hash = EXCLUDED.verified_data_hash,
    verified_source_hash = EXCLUDED.verified_source_hash, source_url = EXCLUDED.source_url,
    source_snippet = EXCLUDED.source_snippet, verdict = EXCLUDED.verdict,
    findings = EXCLUDED.findings, agent_run_id = EXCLUDED.agent_run_id,
    verified_by = EXCLUDED.verified_by, verified_at = now(), updated_at = now();

  INSERT INTO public.convocatoria_verification_history (
    convocatoria_id, state, data_hash, source_hash, source_url, verdict, findings, agent_run_id, verified_by
  ) VALUES (
    p_convocatoria_id, v_state, v_hash, p_source_hash, p_source_url, p_verdict, p_findings, p_agent_run_id, p_verified_by
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Auto-invalidación del DATO PROPIO: si cambia cualquier campo de proceso de la
--    convocatoria y el hash ya no cuadra, la verificación pasa a 'stale'. IS DISTINCT FROM
--    evita marcar stale en UPDATEs que no cambian el contenido (idempotencia).
CREATE OR REPLACE FUNCTION public.tg_convocatoria_invalidate_verif()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.convocatoria_verification v
     SET state = 'stale', updated_at = now()
   WHERE v.convocatoria_id = NEW.id
     AND v.state IN ('verified_correct','verified_issues')
     AND v.verified_data_hash IS DISTINCT FROM public.compute_convocatoria_hash(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_convocatoria_invalidate_verif ON public.convocatorias;
CREATE TRIGGER trg_convocatoria_invalidate_verif
  AFTER UPDATE OF exam_date, exam_date_approximate, plazas_libres, plazas_promocion_interna,
                  plazas_discapacidad, estado_proceso, inscription_start, inscription_deadline
  ON public.convocatorias
  FOR EACH ROW EXECUTE FUNCTION public.tg_convocatoria_invalidate_verif();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Vista de estado EFECTIVO por convocatoria vigente. La lee /admin/contenido.
--    Toda convocatoria is_current sin fila de verificación = 'never_verified' (honesto:
--    no la hemos verificado). El drift contra la FUENTE (outdated_documento) se añadirá
--    cuando exista el registro de documentos con su hash vivo (siguiente incremento).
CREATE OR REPLACE VIEW public.convocatoria_verification_effective AS
SELECT
  c.id                                   AS convocatoria_id,
  c.oposicion_id                         AS oposicion_id,
  COALESCE(v.state, 'never_verified')    AS effective_state,
  v.verdict,
  v.source_url,
  v.source_snippet,
  v.findings,
  v.verified_at
FROM public.convocatorias c
LEFT JOIN public.convocatoria_verification v ON v.convocatoria_id = c.id
WHERE c.is_current = true;

COMMIT;
