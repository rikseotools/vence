-- 20260710_topic_scope_verification.sql
-- Sistema de verificación + provenance de topic_scope contra el epígrafe.
--
-- Objetivo: saber, por tema, si su topic_scope ha sido ANALIZADO (con la
-- metodología del manual de epígrafes) y si sigue siendo válido. Se invalida
-- automáticamente cuando cambia el epígrafe o el scope (hash), igual que el
-- lifecycle de preguntas invalida por construcción.
--
-- Estados (honestos, no binario "perfecto"):
--   never_verified   — nunca analizado
--   verifying        — pipeline en curso
--   verified_correct — 2 agentes independientes coinciden en "correcto"
--   verified_issues  — analizado, se encontraron problemas (a corregir)
--   stale            — se verificó, pero el epígrafe/scope cambió desde entonces
--
-- Invariante: verified_* solo lo puede poner record_topic_verification(), que
-- captura el hash verificado. Cualquier cambio posterior de scope/epígrafe que
-- altere el hash dispara el trigger → 'stale'. Un edit manual NUNCA deja un
-- "verificado" colgado sobre datos cambiados.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Hash determinista de (epígrafe + filas de topic_scope) de un tema
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION compute_topic_scope_hash(p_topic_id uuid)
RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT md5(
    coalesce((SELECT epigrafe FROM topics WHERE id = p_topic_id), '')
    || '||' ||
    coalesce((
      SELECT string_agg(row_repr, '|' ORDER BY row_repr)
      FROM (
        SELECT
          ts.law_id::text || ':' ||
          coalesce((
            SELECT string_agg(a, ',' ORDER BY a)
            FROM unnest(ts.article_numbers) AS a
          ), '') || ':' ||
          coalesce(ts.include_full_title::text, '') || ':' ||
          coalesce(ts.include_full_chapter::text, '') AS row_repr
        FROM topic_scope ts
        WHERE ts.topic_id = p_topic_id
      ) s
    ), '')
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Tabla de estado (1 fila por tema) + historial append-only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topic_scope_verification (
  topic_id             uuid PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  state                text NOT NULL DEFAULT 'never_verified'
                         CHECK (state IN ('never_verified','verifying','verified_correct','verified_issues','stale')),
  verified_scope_hash  text,                 -- hash sobre el que se emitió el veredicto
  verdict              text,                 -- 'correct' | 'issues' | null
  findings             jsonb,                -- hallazgos de los agentes
  agent_run_id         text,                 -- id del workflow/run que lo verificó
  verified_by          text,                 -- 'multi_agent' | admin | ...
  verified_at          timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsv_state ON topic_scope_verification(state);

CREATE TABLE IF NOT EXISTS topic_scope_verification_history (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id      uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  state         text NOT NULL,
  scope_hash    text,
  verdict       text,
  findings      jsonb,
  agent_run_id  text,
  verified_by   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tsv_hist_topic ON topic_scope_verification_history(topic_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Única vía legítima de marcar verificado (captura el hash actual)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_topic_verification(
  p_topic_id     uuid,
  p_verdict      text,          -- 'correct' | 'issues'
  p_findings     jsonb,
  p_agent_run_id text,
  p_verified_by  text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_hash  text;
  v_state text;
BEGIN
  IF p_verdict NOT IN ('correct','issues') THEN
    RAISE EXCEPTION 'verdict inválido: % (correct|issues)', p_verdict;
  END IF;
  v_hash  := compute_topic_scope_hash(p_topic_id);
  v_state := CASE p_verdict WHEN 'correct' THEN 'verified_correct' ELSE 'verified_issues' END;

  INSERT INTO topic_scope_verification
    (topic_id, state, verified_scope_hash, verdict, findings, agent_run_id, verified_by, verified_at, updated_at)
  VALUES
    (p_topic_id, v_state, v_hash, p_verdict, p_findings, p_agent_run_id, p_verified_by, now(), now())
  ON CONFLICT (topic_id) DO UPDATE SET
    state=EXCLUDED.state, verified_scope_hash=EXCLUDED.verified_scope_hash, verdict=EXCLUDED.verdict,
    findings=EXCLUDED.findings, agent_run_id=EXCLUDED.agent_run_id, verified_by=EXCLUDED.verified_by,
    verified_at=now(), updated_at=now();

  INSERT INTO topic_scope_verification_history
    (topic_id, state, scope_hash, verdict, findings, agent_run_id, verified_by)
  VALUES (p_topic_id, v_state, v_hash, p_verdict, p_findings, p_agent_run_id, p_verified_by);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Invalidación automática: si cambia epígrafe/scope y el hash difiere → stale
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tg_topic_scope_invalidate_verif()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_topic uuid := COALESCE(NEW.topic_id, OLD.topic_id);
BEGIN
  UPDATE topic_scope_verification v
  SET state = 'stale', updated_at = now()
  WHERE v.topic_id = v_topic
    AND v.state IN ('verified_correct','verified_issues')
    AND v.verified_scope_hash IS DISTINCT FROM compute_topic_scope_hash(v_topic);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION tg_topic_epigrafe_invalidate_verif()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.epigrafe IS DISTINCT FROM OLD.epigrafe THEN
    UPDATE topic_scope_verification v
    SET state = 'stale', updated_at = now()
    WHERE v.topic_id = NEW.id
      AND v.state IN ('verified_correct','verified_issues')
      AND v.verified_scope_hash IS DISTINCT FROM compute_topic_scope_hash(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topic_scope_invalidate_verif ON topic_scope;
CREATE TRIGGER trg_topic_scope_invalidate_verif
  AFTER INSERT OR UPDATE OR DELETE ON topic_scope
  FOR EACH ROW EXECUTE FUNCTION tg_topic_scope_invalidate_verif();

DROP TRIGGER IF EXISTS trg_topic_epigrafe_invalidate_verif ON topics;
CREATE TRIGGER trg_topic_epigrafe_invalidate_verif
  AFTER UPDATE OF epigrafe ON topics
  FOR EACH ROW EXECUTE FUNCTION tg_topic_epigrafe_invalidate_verif();
