-- 20260719_topic_publish_gate.sql
-- Gate de publicación (Capa 4 del sistema de completitud de leyes): un tema NO
-- puede pasar a `disponible` si una ley de su `topic_scope` está `incomplete`
-- (le faltan artículos vs su fuente oficial). Es la garantía "por construcción"
-- que impide que vuelva a entrar el escenario Ana (publicar un tema cuyo contenido
-- legal está a medias).
--
-- Precisión a propósito: bloquea SOLO `incomplete` (contenido definitivamente roto
-- vs fuente), NO `never_verified`/`no_source` (eso es "no comprobado aún", no
-- "roto" — bloquearlo impediría publicar cualquier tema con ley regional).
--
-- Grandfathering: solo dispara en la TRANSICIÓN a disponible (INSERT con
-- disponible=true, o UPDATE false→true). Los temas ya publicados con una ley
-- incomplete siguen publicados (no se rompen); el cron + badge los afloran para
-- drenarlos. Mismo patrón que el guard anti-falso-verde de `laws`.

CREATE OR REPLACE FUNCTION tg_topics_gate_incomplete_laws()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bad text;
BEGIN
  IF NEW.disponible IS TRUE
     AND (TG_OP = 'INSERT' OR OLD.disponible IS DISTINCT FROM TRUE) THEN
    SELECT string_agg(DISTINCT e.short_name, ', ')
      INTO bad
    FROM topic_scope ts
    JOIN law_verification_effective e ON e.law_id = ts.law_id
    WHERE ts.topic_id = NEW.id AND e.effective_state = 'incomplete';
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION
        'No se puede publicar el tema % (id %): ley(es) del scope con articulos faltantes vs fuente: %',
        NEW.topic_number, NEW.id, bad
        USING HINT = 'completa la ley (docs/runbooks/completitud-leyes.md) antes de publicar el tema';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topics_gate_incomplete_laws ON topics;
CREATE TRIGGER trg_topics_gate_incomplete_laws
  BEFORE INSERT OR UPDATE OF disponible ON topics
  FOR EACH ROW EXECUTE FUNCTION tg_topics_gate_incomplete_laws();
