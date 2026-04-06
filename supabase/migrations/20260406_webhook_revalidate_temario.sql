-- Webhook para invalidar cache del temario automáticamente
-- cuando se modifican topics, oposicion_bloques o topic_scope.
--
-- REQUISITO: Configurar en Supabase Dashboard → Database → Webhooks
-- O ejecutar este SQL directamente en el SQL Editor.
--
-- IMPORTANTE: Añadir SUPABASE_WEBHOOK_SECRET a Vercel env vars.

-- Habilitar pg_net si no está habilitado
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Función que llama al webhook
CREATE OR REPLACE FUNCTION public.notify_temario_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  webhook_url TEXT := 'https://www.vence.es/api/admin/revalidate-temario';
  webhook_secret TEXT;
BEGIN
  -- Leer el secret de vault (o hardcodear si no usas vault)
  -- Para Supabase vault: SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'WEBHOOK_REVALIDATE_SECRET';
  webhook_secret := current_setting('app.webhook_revalidate_secret', true);

  -- Si no hay secret configurado, usar uno por defecto (menos seguro)
  IF webhook_secret IS NULL OR webhook_secret = '' THEN
    webhook_secret := 'c3b13ca58bd02b6aa5844e0a91c9cc84571dc1e9339c085a57179c6018f6d8f8';
  END IF;

  -- Llamar al webhook con un delay de 2 segundos (para agrupar cambios batch)
  PERFORM net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'timestamp', now()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers en las 3 tablas relevantes
DROP TRIGGER IF EXISTS trg_topics_revalidate ON topics;
CREATE TRIGGER trg_topics_revalidate
  AFTER INSERT OR UPDATE OR DELETE ON topics
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.notify_temario_change();

DROP TRIGGER IF EXISTS trg_oposicion_bloques_revalidate ON oposicion_bloques;
CREATE TRIGGER trg_oposicion_bloques_revalidate
  AFTER INSERT OR UPDATE OR DELETE ON oposicion_bloques
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.notify_temario_change();

DROP TRIGGER IF EXISTS trg_topic_scope_revalidate ON topic_scope;
CREATE TRIGGER trg_topic_scope_revalidate
  AFTER INSERT OR UPDATE OR DELETE ON topic_scope
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.notify_temario_change();

-- También para cambios en la tabla oposiciones (landing data)
DROP TRIGGER IF EXISTS trg_oposiciones_revalidate ON oposiciones;
CREATE TRIGGER trg_oposiciones_revalidate
  AFTER INSERT OR UPDATE OR DELETE ON oposiciones
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.notify_temario_change();

COMMENT ON FUNCTION public.notify_temario_change() IS
  'Llama al webhook /api/admin/revalidate-temario para invalidar cache Next.js cuando cambian datos del temario o landings.';
