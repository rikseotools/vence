-- 20260604_fanout_url_landing.sql
-- Fase 8 (8c) ajuste: el aviso de la campana lleva a NUESTRA landing (/<slug>),
-- no a la url oficial del hito. El enlace a la fuente oficial ya vive EN la
-- landing (timeline: cada hito es <a href={hito.url} target=_blank>), así el
-- opositor se queda en Vence y desde ahí va al BOE/boletín si quiere.
-- (Decisión Manuel 04/06, opción A.)
--
-- Solo cambia user_oposicion_alerts.url (nuestra landing). NO toca
-- convocatoria_hitos.url (que sigue siendo la fuente oficial, usada en la landing).
-- Idempotente (CREATE OR REPLACE). Fail-open + observable (igual que antes).

CREATE OR REPLACE FUNCTION public.tg_hito_fanout_alerts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text;
BEGIN
  IF NEW.notify_status <> 'verified' OR NEW.severity = 'cosmetic' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.notify_status = 'verified' THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO v_slug FROM public.oposiciones WHERE id = NEW.oposicion_id;

  INSERT INTO public.user_oposicion_alerts
    (user_id, oposicion_id, hito_id, titulo, descripcion, severity, url)
  SELECT s.user_id, NEW.oposicion_id, NEW.id, NEW.titulo, NEW.descripcion, NEW.severity,
         COALESCE('/' || v_slug, NEW.url)   -- nuestra landing; fallback url oficial si no hay slug
  FROM public.user_oposiciones_seguidas s
  WHERE s.oposicion_id = NEW.oposicion_id
    AND s.notify_bell = true
  ON CONFLICT (user_id, hito_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    INSERT INTO public.observable_events (source, severity, event_type, error_message, metadata)
    VALUES ('postgres', 'error', 'hito_fanout_failed', SQLERRM,
            jsonb_build_object('trigger','tg_hito_fanout_alerts','hito_id',NEW.id,'oposicion_id',NEW.oposicion_id));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE WARNING 'tg_hito_fanout_alerts falló hito=%: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Corregir los avisos ya creados: url → nuestra landing.
UPDATE public.user_oposicion_alerts a
SET url = '/' || o.slug
FROM public.oposiciones o
WHERE o.id = a.oposicion_id;
