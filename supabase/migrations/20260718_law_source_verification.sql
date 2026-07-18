-- 20260718_law_source_verification.sql
-- Verificación + provenance de la COMPLETITUD de una ley contra su FUENTE oficial.
--
-- Gap que cierra (caso Ana Llano, ULE T18, 18/07/2026): una ley importada a medias
-- (9 de 74 arts), sin boe_url, NUNCA verificada, pero con verification_status=
-- 'actualizada' (falso verde) → invisible al monitor BOE (que solo parsea el BOE
-- consolidado; las ~400 regionales/editoriales quedan fuera). Lo cazó una usuaria.
--
-- Calcado a topic_scope_verification (20260710): estado por ley, invalidación por
-- HASH del contenido propio, única vía legítima de marcar verificado, historial
-- append-only. Añade lo específico de "vs FUENTE externa": segundo hash (la fuente)
-- y una VISTA que deriva el estado HONESTO sin confiar en el label mentiroso.
--
-- Estados:
--   never_verified — nunca comparada contra su fuente
--   verifying      — verificación en curso
--   verified       — evidencia: cubre la fuente (is_ok, sin faltantes)
--   incomplete     — evidencia: faltan artículos respecto a la fuente
--   issues         — evidencia: contenido/títulos divergen de la fuente
--   no_source      — no virtual y sin URL de fuente → inverificable
--   stale          — se verificó, pero el articulado cambió desde entonces

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Hash determinista del CONTENIDO propio (inventario de artículos + fuente)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_law_content_hash(p_law_id uuid)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT md5(
    coalesce((SELECT boe_url FROM laws WHERE id = p_law_id), '')
    || '||' ||
    coalesce((
      SELECT string_agg(a.article_number, ',' ORDER BY a.article_number)
      FROM articles a
      WHERE a.law_id = p_law_id AND coalesce(a.is_active, true)
    ), '')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabla de estado (1 fila por ley) + historial append-only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS law_source_verification (
  law_id                 uuid PRIMARY KEY REFERENCES laws(id) ON DELETE CASCADE,
  state                  text NOT NULL DEFAULT 'never_verified'
                           CHECK (state IN ('never_verified','verifying','verified','incomplete','issues','no_source','stale')),
  verified_content_hash  text,            -- hash del contenido propio al emitir el veredicto
  verified_source_hash   text,            -- huella de la FUENTE externa en ese instante
  source_url             text,            -- URL oficial contra la que se verificó
  boe_count              int,             -- nº de artículos en la fuente
  db_count               int,             -- nº de artículos en BD
  missing_in_db          int,             -- faltantes (fuente - BD)
  verdict                text,            -- 'verified' | 'incomplete' | 'issues' | null
  findings               jsonb,           -- provenance: {missing:[...], mismatch:[...]}
  verified_by            text,            -- 'multi_agent' | 'boe_sync' | admin
  agent_run_id           text,
  verified_at            timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lsv_state ON law_source_verification(state);

CREATE TABLE IF NOT EXISTS law_source_verification_history (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  law_id        uuid NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  state         text NOT NULL,
  content_hash  text,
  source_hash   text,
  verdict       text,
  findings      jsonb,
  verified_by   text,
  agent_run_id  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lsv_hist_law ON law_source_verification_history(law_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Única vía legítima de marcar verificado (captura los dos hashes + evidencia)
--    Espejo de record_topic_verification. NUNCA se marca "verified" sin contar
--    artículos contra la fuente — imposible el "falso verde" por esta vía.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_law_source_verification(
  p_law_id       uuid,
  p_verdict      text,          -- 'verified' | 'incomplete' | 'issues'
  p_source_url   text,
  p_source_hash  text,
  p_boe_count    int,
  p_db_count     int,
  p_missing      int,
  p_findings     jsonb,
  p_verified_by  text,
  p_agent_run_id text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_content_hash text;
  v_state text;
BEGIN
  IF p_verdict NOT IN ('verified','incomplete','issues') THEN
    RAISE EXCEPTION 'verdict inválido: % (verified|incomplete|issues)', p_verdict;
  END IF;
  -- Coherencia: no se puede declarar "verified" con faltantes.
  IF p_verdict = 'verified' AND coalesce(p_missing,0) > 0 THEN
    RAISE EXCEPTION 'verified con % faltantes: usa incomplete', p_missing;
  END IF;
  v_content_hash := compute_law_content_hash(p_law_id);
  v_state := p_verdict;  -- verified|incomplete|issues coinciden con el estado

  INSERT INTO law_source_verification
    (law_id, state, verified_content_hash, verified_source_hash, source_url,
     boe_count, db_count, missing_in_db, verdict, findings, verified_by, agent_run_id, verified_at, updated_at)
  VALUES
    (p_law_id, v_state, v_content_hash, p_source_hash, p_source_url,
     p_boe_count, p_db_count, p_missing, p_verdict, p_findings, p_verified_by, p_agent_run_id, now(), now())
  ON CONFLICT (law_id) DO UPDATE SET
    state=EXCLUDED.state, verified_content_hash=EXCLUDED.verified_content_hash,
    verified_source_hash=EXCLUDED.verified_source_hash, source_url=EXCLUDED.source_url,
    boe_count=EXCLUDED.boe_count, db_count=EXCLUDED.db_count, missing_in_db=EXCLUDED.missing_in_db,
    verdict=EXCLUDED.verdict, findings=EXCLUDED.findings, verified_by=EXCLUDED.verified_by,
    agent_run_id=EXCLUDED.agent_run_id, verified_at=now(), updated_at=now();

  INSERT INTO law_source_verification_history
    (law_id, state, content_hash, source_hash, verdict, findings, verified_by, agent_run_id)
  VALUES (p_law_id, v_state, v_content_hash, p_source_hash, p_verdict, p_findings, p_verified_by, p_agent_run_id);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Invalidación automática: si cambia el articulado y el hash difiere → stale
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tg_articles_invalidate_law_verif()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_law uuid := COALESCE(NEW.law_id, OLD.law_id);
BEGIN
  UPDATE law_source_verification v
  SET state = 'stale', updated_at = now()
  WHERE v.law_id = v_law
    AND v.state IN ('verified','incomplete','issues')
    AND v.verified_content_hash IS DISTINCT FROM compute_law_content_hash(v_law);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_articles_invalidate_law_verif ON articles;
CREATE TRIGGER trg_articles_invalidate_law_verif
  AFTER INSERT OR UPDATE OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION tg_articles_invalidate_law_verif();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Guard "anti-falso-verde": no se puede marcar la ley 'actualizada' en `laws`
--    sin evidencia (last_verification_summary). Es el bug raíz del caso ULE T18.
--    Los flujos legítimos (monitoreo BOE) escriben SIEMPRE ambos a la vez.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tg_laws_block_false_green()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.verification_status = 'actualizada'
     AND NEW.last_verification_summary IS NULL
     AND coalesce(NEW.is_virtual, false) = false THEN
    RAISE EXCEPTION 'falso verde: verification_status=actualizada sin last_verification_summary (ley %). Verifica contra fuente y escribe la evidencia.', NEW.id
      USING HINT = 'usa el flujo de docs/runbooks/completitud-leyes.md';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_laws_block_false_green ON laws;
CREATE TRIGGER trg_laws_block_false_green
  BEFORE INSERT OR UPDATE OF verification_status, last_verification_summary ON laws
  FOR EACH ROW EXECUTE FUNCTION tg_laws_block_false_green();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. VISTA del estado HONESTO — deriva de la EVIDENCIA, nunca del label.
--    Mirror SQL de lib/laws/completeness.ts (classifyLawCompleteness). El badge y
--    los lectores leen de aquí para no volver a fiarse de verification_status.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW law_verification_effective AS
SELECT
  l.id AS law_id,
  l.short_name,
  l.scope,
  l.is_virtual,
  (l.boe_url IS NOT NULL AND btrim(l.boe_url) <> '') AS has_source,
  EXISTS (SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
          WHERE ts.law_id = l.id AND t.disponible) AS serving_live,
  CASE
    WHEN coalesce(l.is_virtual, false) THEN 'verified'
    WHEN l.last_verification_summary IS NULL THEN
      CASE
        WHEN lower(coalesce(l.verification_status,'')) IN ('actualizada','verificada') THEN 'false_green'
        WHEN l.boe_url IS NULL OR btrim(l.boe_url) = '' THEN 'no_source'
        ELSE 'never_verified'
      END
    WHEN (l.last_verification_summary->>'no_consolidated_text')::boolean IS TRUE
      OR (l.last_verification_summary->>'historical')::boolean IS TRUE THEN 'verified'
    WHEN coalesce((l.last_verification_summary->>'missing_in_db')::int,
                  greatest(0, coalesce((l.last_verification_summary->>'boe_count')::int,0)
                            - coalesce((l.last_verification_summary->>'db_count')::int,0))) > 0 THEN 'incomplete'
    WHEN coalesce((l.last_verification_summary->>'content_mismatch')::int,0) > 0
      OR coalesce((l.last_verification_summary->>'title_mismatch')::int,0) > 0 THEN 'issues'
    ELSE 'verified'
  END AS effective_state
FROM laws l;

COMMENT ON VIEW law_verification_effective IS
  'Estado HONESTO de verificación ley↔fuente derivado de la evidencia (last_verification_summary + boe_url), ignorando el label verification_status. Mirror de lib/laws/completeness.ts.';
