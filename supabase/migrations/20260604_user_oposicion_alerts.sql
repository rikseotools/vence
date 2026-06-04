-- 20260604_user_oposicion_alerts.sql
-- Fase 8 — paso 8c: feed in-app de avisos por hito + fan-out.
--
-- Cuando un hito pasa a notify_status='verified' (acto humano/Claude tras
-- confirmar fuente oficial — GUARDARRAÍL) y NO es cosmético, se crea un aviso
-- para CADA usuario que sigue esa oposición con la campana activada
-- (target ∪ favoritas). La campana 🔔 lee este feed.
--
-- Robusto/escalable: 1 INSERT...SELECT por verificación (acción infrecuente de
-- admin; miles de filas como mucho, indexado). Idempotente: unique(user,hito).
-- Fail-open + observable: si el fan-out falla, NO bloquea la verificación del
-- hito y deja rastro en observable_events.
--
-- El email (8d) NO se toca aquí: este feed es SOLO campana.
-- AGNÓSTICO: Postgres estándar + RLS lockdown. Idempotente.

CREATE TABLE IF NOT EXISTS public.user_oposicion_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oposicion_id  UUID NOT NULL REFERENCES public.oposiciones(id) ON DELETE CASCADE,
  hito_id       UUID NOT NULL REFERENCES public.convocatoria_hitos(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,                 -- snapshot del hito (estable aunque cambie)
  descripcion   TEXT,
  severity      TEXT NOT NULL,
  url           TEXT,
  read_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, hito_id)
);

COMMENT ON TABLE public.user_oposicion_alerts IS
  'Fase 8: feed in-app (campana) de avisos por hito verificado de oposiciones seguidas. read_at = leído (server-side, multi-dispositivo).';

-- Consulta de la campana: avisos del usuario por fecha, y conteo de no leídos.
CREATE INDEX IF NOT EXISTS idx_alerts_user_created
  ON public.user_oposicion_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_user_unread
  ON public.user_oposicion_alerts (user_id)
  WHERE read_at IS NULL;

ALTER TABLE public.user_oposicion_alerts ENABLE ROW LEVEL SECURITY;

-- ── Fan-out: hito 'verified' (no cosmético) → aviso a los seguidores ──
CREATE OR REPLACE FUNCTION public.tg_hito_fanout_alerts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Solo hitos verificados y notificables.
  IF NEW.notify_status <> 'verified' OR NEW.severity = 'cosmetic' THEN
    RETURN NEW;
  END IF;
  -- Solo en la TRANSICIÓN a verified (no re-disparar en updates posteriores).
  IF TG_OP = 'UPDATE' AND OLD.notify_status = 'verified' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.user_oposicion_alerts
    (user_id, oposicion_id, hito_id, titulo, descripcion, severity, url)
  SELECT s.user_id, NEW.oposicion_id, NEW.id, NEW.titulo, NEW.descripcion, NEW.severity, NEW.url
  FROM public.user_oposiciones_seguidas s
  WHERE s.oposicion_id = NEW.oposicion_id
    AND s.notify_bell = true
  ON CONFLICT (user_id, hito_id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fail-open: verificar un hito NO debe romperse por el fan-out. Observable.
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

DROP TRIGGER IF EXISTS tg_convocatoria_hitos_fanout ON public.convocatoria_hitos;
CREATE TRIGGER tg_convocatoria_hitos_fanout
  AFTER INSERT OR UPDATE OF notify_status ON public.convocatoria_hitos
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_hito_fanout_alerts();

COMMENT ON FUNCTION public.tg_hito_fanout_alerts() IS
  'Fase 8: al verificar un hito (notify_status->verified, no cosmético), crea avisos en user_oposicion_alerts para los seguidores con campana. Idempotente, fail-open, observable.';
