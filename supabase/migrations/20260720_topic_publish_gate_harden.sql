-- ─────────────────────────────────────────────────────────────────────────────
-- Endurece el GATE de publicación de temas (completitud de leyes).
--
-- CONTEXTO: `20260719_topic_publish_gate.sql` bloquea publicar un tema si una ley
-- del scope está `incomplete` (artículos faltantes vs fuente). Pero el backlog de
-- completitud REINCIDE al alza: cada build de oposición nueva mete leyes regionales
-- `no_source` (sin fuente oficial) — el gate no lo cazaba y solo se detectaba a
-- posteriori (cron de regresión) para drenarlas a mano. Medido 20/07: 13 leyes
-- `no_source` nuevas (organismos internacionales/UE) entraron en temas vivos.
--
-- FIX (cortar en origen): el gate bloquea ahora, además de `incomplete`:
--   · `false_green` — miente que está `actualizada` sin evidencia (el guard
--     `trg_laws_block_false_green` ya impide CREAR nuevas; esto cubre re-publicar
--     un tema que escope una legacy).
--   · `no_source`   — ni fuente ni evidencia: inverificable por construcción.
-- NO bloquea:
--   · `never_verified` — tiene fuente pero no parseó (boletín finicky); es legítimo,
--     no debemos bloquear una publicación por una fuente que el extractor no lee.
--   · `issues`         — el contenido diverge de la fuente = decisión editorial
--     (p.ej. Convenio Budapest: 48/48 arts presentes pero resumidos), no un hueco.
--
-- GRANDFATHERING (sin cambios): solo dispara al PUBLICAR (INSERT o `disponible`
-- false→true). Los temas YA publicados con leyes en deuda siguen vivos; se corrigen
-- cuando se re-tocan. Así un build nuevo DEBE registrar la fuente o eximir
-- (`no_consolidated_text`) cada ley del scope antes de publicar el tema.
--
-- Reemplaza la función IN-PLACE (el trigger la referencia por nombre; no se recrea).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION tg_topics_gate_incomplete_laws()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bad text;
BEGIN
  IF NEW.disponible IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.disponible IS DISTINCT FROM TRUE) THEN
    SELECT string_agg(DISTINCT e.short_name || ' (' || e.effective_state || ')', ', ')
      INTO bad
    FROM topic_scope ts
    JOIN law_verification_effective e ON e.law_id = ts.law_id
    WHERE ts.topic_id = NEW.id
      AND e.effective_state IN ('incomplete', 'false_green', 'no_source');
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION
        'No se puede publicar el tema % (id %): ley(es) del scope sin verificar/sin fuente oficial: %',
        NEW.topic_number, NEW.id, bad
        USING HINT = 'verifica/registra la fuente (verify-law-source.cjs) o exime (no_consolidated_text) las leyes del scope antes de publicar el tema — docs/runbooks/completitud-leyes.md';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
