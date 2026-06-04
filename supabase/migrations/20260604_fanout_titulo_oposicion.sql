-- 20260604_fanout_titulo_oposicion.sql
-- Fase 8 (8c) ajuste UX (Manuel 04/06): el aviso de la campana debe indicar
-- PRIMERO la oposición (un usuario sigue varias). El titulo del aviso pasa a
-- "<Oposición>: <hito>", p.ej. "Auxiliar Administrativo Comunidad de Madrid:
-- Lista provisional de admitidos y excluidos".
--
-- Se hornea en user_oposicion_alerts.titulo (ya es un snapshot de display) →
-- NO requiere deploy de frontend (el bell muestra alert.titulo tal cual).
-- Idempotente: el UPDATE de los existentes reconstruye desde el hito original.

CREATE OR REPLACE FUNCTION public.tg_hito_fanout_alerts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_slug text; v_nombre text;
BEGIN
  IF NEW.notify_status <> 'verified' OR NEW.severity = 'cosmetic' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.notify_status = 'verified' THEN
    RETURN NEW;
  END IF;

  SELECT slug, nombre INTO v_slug, v_nombre FROM public.oposiciones WHERE id = NEW.oposicion_id;

  INSERT INTO public.user_oposicion_alerts
    (user_id, oposicion_id, hito_id, titulo, descripcion, severity, url)
  SELECT s.user_id, NEW.oposicion_id, NEW.id,
         COALESCE(v_nombre || ': ', '') || NEW.titulo,   -- oposición primero
         NEW.descripcion, NEW.severity,
         COALESCE('/' || v_slug, NEW.url)                -- nuestra landing
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

-- Reconstruir los avisos ya creados: "<Oposición>: <hito original>".
UPDATE public.user_oposicion_alerts a
SET titulo = o.nombre || ': ' || h.titulo
FROM public.oposiciones o, public.convocatoria_hitos h
WHERE o.id = a.oposicion_id
  AND h.id = a.hito_id
  AND a.titulo NOT LIKE o.nombre || ':%';   -- idempotente: no re-prefijar
