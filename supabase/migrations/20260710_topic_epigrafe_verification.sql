-- 20260710_topic_epigrafe_verification.sql
-- SISTEMA 2 — Verificación de LITERALIDAD del epígrafe contra la convocatoria.
-- INTEGRADO en el sistema de convocatorias/OEP existente (no es un sistema paralelo):
--   * Fuente = convocatorias.programa_url (ya es por-convocatoria).
--   * Detección = el seguimiento que ya existe, extendido al programa (programa_last_hash).
--   * Relacionado con Sistema 1 (topic_scope_verification) por una cascada de UNA dirección:
--     cuando S2 corrige topics.epigrafe → el trigger de S1 ya lo pone scope 'stale'.
--
-- Pregunta que responde S2 (por tema): ¿`topics.epigrafe` es el texto LITERAL del
-- temario de la convocatoria VIGENTE? (el fallo T17: epígrafe paráfrasis, no literal).
--
-- Estados almacenados:
--   never_sourced        — nunca verificado
--   verified_literal     — epígrafe == temario oficial de la convocatoria source
--   drift_detected       — epígrafe NO coincide con el temario oficial (paráfrasis → corregir)
--   provisional_anterior — no hay convocatoria vigente propia; epígrafe de la anterior (provisional)
--   stale                — el epígrafe cambió tras verificar → re-verificar literalidad
-- Estado EFECTIVO (derivado en la vista, considerando la convocatoria vigente):
--   outdated_convocatoria — verificado, pero la convocatoria vigente / su programa cambió

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extender convocatorias: hash del PROGRAMA (temario), espejo de seguimiento_*
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS programa_last_hash    text;
ALTER TABLE convocatorias ADD COLUMN IF NOT EXISTS programa_last_checked timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Estado por tema + historial append-only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topic_epigrafe_verification (
  topic_id                uuid PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  state                   text NOT NULL DEFAULT 'never_sourced'
                            CHECK (state IN ('never_sourced','verified_literal','drift_detected','provisional_anterior','stale')),
  source_convocatoria_id  uuid REFERENCES convocatorias(id) ON DELETE SET NULL,
  verified_epigrafe_hash  text,   -- md5(topics.epigrafe) en la verificación
  verified_programa_hash  text,   -- programa_last_hash de la convocatoria source en la verificación
  findings                jsonb,
  verified_by             text,
  verified_at             timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tev_state ON topic_epigrafe_verification(state);

CREATE TABLE IF NOT EXISTS topic_epigrafe_verification_history (
  id                     uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id               uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  state                  text NOT NULL,
  source_convocatoria_id uuid,
  epigrafe_hash          text,
  programa_hash          text,
  findings               jsonb,
  verified_by            text,
  created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tev_hist_topic ON topic_epigrafe_verification_history(topic_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Única vía de registrar (captura el hash del epígrafe verificado)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_epigrafe_verification(
  p_topic_id                uuid,
  p_verdict                 text,   -- 'literal' | 'drift' | 'provisional'
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
  IF p_verdict NOT IN ('literal','drift','provisional') THEN
    RAISE EXCEPTION 'verdict inválido: % (literal|drift|provisional)', p_verdict;
  END IF;
  v_epi_hash := md5(coalesce((SELECT epigrafe FROM topics WHERE id = p_topic_id), ''));
  v_state := CASE p_verdict
               WHEN 'literal'     THEN 'verified_literal'
               WHEN 'drift'       THEN 'drift_detected'
               WHEN 'provisional' THEN 'provisional_anterior'
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Invalidación por cambio de epígrafe (trigger sobre topics) → stale
--    (S1 tiene su propio trigger sobre el mismo evento; ambos conviven)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION tg_topic_epigrafe_invalidate_s2()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.epigrafe IS DISTINCT FROM OLD.epigrafe THEN
    UPDATE topic_epigrafe_verification v
    SET state = 'stale', updated_at = now()
    WHERE v.topic_id = NEW.id
      AND v.state IN ('verified_literal','drift_detected','provisional_anterior')
      AND v.verified_epigrafe_hash IS DISTINCT FROM md5(coalesce(NEW.epigrafe, ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topic_epigrafe_invalidate_s2 ON topics;
CREATE TRIGGER trg_topic_epigrafe_invalidate_s2
  AFTER UPDATE OF epigrafe ON topics
  FOR EACH ROW EXECUTE FUNCTION tg_topic_epigrafe_invalidate_s2();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Estado EFECTIVO por tema (deriva "outdated_convocatoria" contra la vigente).
--    La invalidación por convocatoria NO es un trigger frágil cross-tabla: se
--    computa aquí contra convocatorias.is_current. Robusto y siempre fresco.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW topic_epigrafe_verification_effective AS
SELECT
  t.id AS topic_id,
  t.position_type,
  cv.id AS current_convocatoria_id,
  cv.programa_last_hash AS current_programa_hash,
  ev.state AS stored_state,
  ev.source_convocatoria_id,
  ev.verified_programa_hash,
  CASE
    WHEN ev.topic_id IS NULL                                         THEN 'never_sourced'
    WHEN ev.state IN ('never_sourced','stale','drift_detected')      THEN ev.state
    WHEN cv.id IS DISTINCT FROM ev.source_convocatoria_id            THEN 'outdated_convocatoria'
    -- solo por hash cuando AMBOS están poblados y difieren (evita falso outdated
    -- mientras programa_last_hash aún no lo puebla el seguimiento)
    WHEN cv.programa_last_hash IS NOT NULL
         AND ev.verified_programa_hash IS NOT NULL
         AND cv.programa_last_hash <> ev.verified_programa_hash      THEN 'outdated_convocatoria'
    ELSE ev.state  -- verified_literal | provisional_anterior
  END AS effective_state
FROM topics t
LEFT JOIN oposiciones o  ON o.slug = replace(t.position_type, '_', '-')
LEFT JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current = true
LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
WHERE t.is_active;
