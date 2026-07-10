-- 20260710_verification_needs_human.sql
-- Estado 'needs_human' en los dos sistemas de verificación de contenido.
-- Las DUDAS (discrepancia entre agentes independientes, o juicios de criterio)
-- NO deben caer en 'verified_issues' silencioso: pasan a 'needs_human' → alertan
-- para revisión humana (badge propio en el panel). El humano decide y re-verifica.

-- ── S1 (scope) ──
ALTER TABLE topic_scope_verification DROP CONSTRAINT IF EXISTS topic_scope_verification_state_check;
ALTER TABLE topic_scope_verification ADD CONSTRAINT topic_scope_verification_state_check
  CHECK (state IN ('never_verified','verifying','verified_correct','verified_issues','needs_human','stale'));

CREATE OR REPLACE FUNCTION record_topic_verification(
  p_topic_id  uuid,   -- (nombre histórico) = topic_id
  p_verdict      text,   -- 'correct' | 'issues' | 'needs_human'
  p_findings     jsonb,
  p_agent_run_id text,
  p_verified_by  text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_hash  text;
  v_state text;
BEGIN
  IF p_verdict NOT IN ('correct','issues','needs_human') THEN
    RAISE EXCEPTION 'verdict inválido: % (correct|issues|needs_human)', p_verdict;
  END IF;
  v_hash  := compute_topic_scope_hash(p_topic_id);
  v_state := CASE p_verdict
               WHEN 'correct'     THEN 'verified_correct'
               WHEN 'issues'      THEN 'verified_issues'
               WHEN 'needs_human' THEN 'needs_human'
             END;

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

-- ── S2 (epígrafe) ──
ALTER TABLE topic_epigrafe_verification DROP CONSTRAINT IF EXISTS topic_epigrafe_verification_state_check;
ALTER TABLE topic_epigrafe_verification ADD CONSTRAINT topic_epigrafe_verification_state_check
  CHECK (state IN ('never_sourced','verified_literal','drift_detected','provisional_anterior','needs_human','stale'));

CREATE OR REPLACE FUNCTION record_epigrafe_verification(
  p_topic_id                uuid,
  p_verdict                 text,   -- 'literal' | 'drift' | 'provisional' | 'needs_human'
  p_source_convocatoria_id  uuid,
  p_programa_hash           text,
  p_findings                jsonb,
  p_verified_by             text
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_epi_hash text;
  v_state    text;
BEGIN
  IF p_verdict NOT IN ('literal','drift','provisional','needs_human') THEN
    RAISE EXCEPTION 'verdict inválido: % (literal|drift|provisional|needs_human)', p_verdict;
  END IF;
  v_epi_hash := md5(coalesce((SELECT epigrafe FROM topics WHERE id = p_topic_id), ''));
  v_state := CASE p_verdict
               WHEN 'literal'     THEN 'verified_literal'
               WHEN 'drift'       THEN 'drift_detected'
               WHEN 'provisional' THEN 'provisional_anterior'
               WHEN 'needs_human' THEN 'needs_human'
             END;

  INSERT INTO topic_epigrafe_verification
    (topic_id, state, source_convocatoria_id, verified_epigrafe_hash, verified_programa_hash, findings, verified_by, verified_at, updated_at)
  VALUES
    (p_topic_id, v_state, p_source_convocatoria_id, v_epi_hash, p_programa_hash, p_findings, p_verified_by, now(), now())
  ON CONFLICT (topic_id) DO UPDATE SET
    state=EXCLUDED.state, source_convocatoria_id=EXCLUDED.source_convocatoria_id,
    verified_epigrafe_hash=EXCLUDED.verified_epigrafe_hash, verified_programa_hash=EXCLUDED.verified_programa_hash,
    findings=EXCLUDED.findings, verified_by=EXCLUDED.verified_by, verified_at=now(), updated_at=now();

  INSERT INTO topic_epigrafe_verification_history
    (topic_id, state, source_convocatoria_id, epigrafe_hash, programa_hash, findings, verified_by)
  VALUES (p_topic_id, v_state, p_source_convocatoria_id, v_epi_hash, p_programa_hash, p_findings, p_verified_by);
END;
$$;

-- La vista _effective ya pasa 'needs_human' tal cual (está entre los estados
-- que devuelve por defecto en la rama ELSE ev.state / cuando no es stale).
