-- 20260722_temario_pdf_hook_scope.sql
--
-- Hook de cambio de contenido (T-086 Fase D, capa 3): al cambiar el topic_scope de un tema (añadir
-- una ley, cambiar los article_numbers, quitar una ley) se ENCOLA ese tema para regenerar su PDF al
-- instante, sin esperar al barrido nocturno. Cierra la ventana entre "cambié el scope" y "se refleja".
--
-- Diseño (robusto, sin flood):
--  - La cola keyea por POSITION_TYPE (clave nativa de topics/topic_scope) → el trigger no necesita
--    mapear a slug en SQL; el worker mapea position_type→slug al renderizar.
--  - Idempotente: content_hash fijo 'hook:scope' + el índice parcial _alive_uq → a lo sumo 1 job
--    vivo por (position_type, tema) del hook, aunque un rebuild de scope toque muchas filas.
--  - Solo cambios RELEVANTES al contenido (law_id o article_numbers); un UPDATE de otra columna
--    (p.ej. weight) no encola.
--  - Solo temas activos y disponibles (no regenerar temas ocultos).
--  - Observabilidad: emite observable_events SOLO cuando encola de verdad (no en los dups) → no
--    inunda en rebuilds masivos.
--
-- Los cambios de CONTENIDO de un artículo (no del scope) NO se cubren con trigger a propósito: un
-- import masivo de una ley dispararía el trigger por-fila (anti-patrón outbox). Esos cambios los
-- recoge el barrido nocturno (el hash content-addressed detecta el cambio y regenera). Añadir una
-- ley a un tema SÍ pasa por topic_scope (INSERT) → cubierto aquí.

CREATE OR REPLACE FUNCTION public.tg_topic_scope_enqueue_pdf()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
DECLARE
  v_topic_id uuid;
  v_pt       text;
  v_tema     integer;
  v_job_id   uuid;
BEGIN
  -- Solo si cambió algo que afecta al contenido del PDF.
  IF TG_OP = 'UPDATE'
     AND NEW.law_id IS NOT DISTINCT FROM OLD.law_id
     AND NEW.article_numbers IS NOT DISTINCT FROM OLD.article_numbers THEN
    RETURN NEW;
  END IF;

  v_topic_id := COALESCE(NEW.topic_id, OLD.topic_id);

  SELECT t.position_type, t.topic_number
    INTO v_pt, v_tema
  FROM public.topics t
  WHERE t.id = v_topic_id AND t.is_active AND t.disponible;

  IF v_pt IS NULL THEN
    RETURN COALESCE(NEW, OLD); -- tema oculto/eliminado → nada que regenerar
  END IF;

  INSERT INTO public.temario_pdf_jobs (oposicion, tema, content_hash)
  VALUES (v_pt, v_tema, 'hook:scope')
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_job_id;

  -- Observabilidad solo en el encolado real (dedup → no inunda en rebuilds).
  IF v_job_id IS NOT NULL THEN
    INSERT INTO public.observable_events (source, severity, event_type, endpoint, metadata)
    VALUES ('hook', 'info', 'temario_pdf_hook_enqueued', 'trigger:topic_scope',
            jsonb_build_object('oposicion', v_pt, 'tema', v_tema, 'op', TG_OP));
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tg_topic_scope_enqueue_pdf ON public.topic_scope;
CREATE TRIGGER tg_topic_scope_enqueue_pdf
  AFTER INSERT OR UPDATE OR DELETE ON public.topic_scope
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_topic_scope_enqueue_pdf();
