-- 20260604_seguidas_observability.sql
-- Fase 8 — cierre de gaps de observabilidad de los triggers de seguidas.
-- "Profesional, robusto, escalable, sin gaps ni chapuzas" (Manuel 04/06).
--
-- Nuestra observabilidad propia = tabla observable_events (NO Sentry, que se
-- retira). Los dos triggers de Fase 8 dejan ahora rastro ahí ante fallo, de
-- forma EXCEPTION-SAFE ANIDADA: ni el logging puede romper la operación.
--
--   1) tg_test_autoadd_favorita (AFTER INSERT tests): ya era fail-open; ahora
--      además emite a observable_events (severity warn = best-effort).
--   2) sync_user_oposiciones_seguidas (target→favoritas): ERA FAIL-CLOSED —
--      un fallo del bookkeeping ABORTABA el cambio de oposición del usuario.
--      Gap real. Pasa a FAIL-OPEN + observable (severity error): el cambio de
--      target (acción central, fuente de verdad = user_profiles.target_oposicion)
--      NUNCA se bloquea por un fallo al sincronizar la tabla derivada.
--
-- source='postgres' (texto libre, sin check). severity ∈ check
-- (debug/info/warn/error/critical). Idempotente (CREATE OR REPLACE).

-- ── 1) Auto-add favorita al crear test ──
CREATE OR REPLACE FUNCTION public.tg_test_autoadd_favorita()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_oposicion_id uuid;
BEGIN
  IF NEW.user_id IS NULL OR NEW.position_type IS NULL OR NEW.position_type = '' THEN
    RETURN NEW;
  END IF;
  SELECT id INTO v_oposicion_id FROM public.oposiciones
   WHERE slug = replace(NEW.position_type, '_', '-') LIMIT 1;
  IF v_oposicion_id IS NOT NULL THEN
    INSERT INTO public.user_oposiciones_seguidas (user_id, oposicion_id, rol)
    VALUES (NEW.user_id, v_oposicion_id, 'favorita')
    ON CONFLICT (user_id, oposicion_id) DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Observabilidad propia (anidada: ni esto puede romper el INSERT de test).
  BEGIN
    INSERT INTO public.observable_events (source, severity, event_type, user_id, error_message, metadata)
    VALUES ('postgres', 'warn', 'seguidas_autoadd_failed', NEW.user_id, SQLERRM,
            jsonb_build_object('trigger', 'tg_test_autoadd_favorita', 'position_type', NEW.position_type));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE WARNING 'tg_test_autoadd_favorita falló user=% position_type=%: %', NEW.user_id, NEW.position_type, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── 2) Sync target→favoritas al cambiar target_oposicion ──
CREATE OR REPLACE FUNCTION public.sync_user_oposiciones_seguidas()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_oposicion_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.target_oposicion IS NOT DISTINCT FROM OLD.target_oposicion THEN
    RETURN NEW;
  END IF;

  IF NEW.target_oposicion IS NOT NULL AND NEW.target_oposicion <> '' THEN
    SELECT o.id INTO v_new_oposicion_id FROM public.oposiciones o
     WHERE o.slug = replace(NEW.target_oposicion, '_', '-') LIMIT 1;
  END IF;

  UPDATE public.user_oposiciones_seguidas
     SET rol = 'favorita', updated_at = now()
   WHERE user_id = NEW.id AND rol = 'target'
     AND (v_new_oposicion_id IS NULL OR oposicion_id <> v_new_oposicion_id);

  IF v_new_oposicion_id IS NOT NULL THEN
    INSERT INTO public.user_oposiciones_seguidas (user_id, oposicion_id, rol)
    VALUES (NEW.id, v_new_oposicion_id, 'target')
    ON CONFLICT (user_id, oposicion_id) DO UPDATE SET rol = 'target', updated_at = now();
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- FAIL-OPEN: el cambio de target NO se bloquea por un fallo de bookkeeping.
  BEGIN
    INSERT INTO public.observable_events (source, severity, event_type, user_id, error_message, metadata)
    VALUES ('postgres', 'error', 'seguidas_sync_failed', NEW.id, SQLERRM,
            jsonb_build_object('trigger', 'tg_sync_user_oposiciones_seguidas', 'target_oposicion', NEW.target_oposicion));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE WARNING 'sync_user_oposiciones_seguidas falló user=%: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
