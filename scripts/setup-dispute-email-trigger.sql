-- Script para configurar trigger automático de emails de impugnaciones
-- Ejecutar como superuser en Supabase

-- 1. Habilitar extensión http si no está habilitada
CREATE EXTENSION IF NOT EXISTS http;

-- 2. Crear función que envíe email cuando cambie el status de disputa
CREATE OR REPLACE FUNCTION send_dispute_email_notification()
RETURNS TRIGGER AS $$
DECLARE
  api_url TEXT;
  api_response http_response;
BEGIN
  -- Solo enviar email si el status cambió y es resolved o rejected
  IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('resolved', 'rejected')) THEN
    
    -- URL del API endpoint (ajustar según tu dominio)
    api_url := COALESCE(
      current_setting('app.base_url', true),
      'https://www.vence.es'
    ) || '/api/send-dispute-email';
    
    -- Log para debugging
    RAISE LOG 'Enviando email de impugnación para disputa ID: %, nuevo status: %', NEW.id, NEW.status;
    
    -- Llamar al endpoint API de forma asíncrona
    BEGIN
      SELECT * INTO api_response FROM http_post(
        api_url,
        json_build_object('disputeId', NEW.id)::text,
        'application/json'
      );
      
      -- Log del resultado
      IF api_response.status >= 200 AND api_response.status < 300 THEN
        RAISE LOG 'Email de impugnación enviado exitosamente para disputa %', NEW.id;
      ELSE
        RAISE WARNING 'Error enviando email de impugnación para disputa %. Status: %, Response: %', 
          NEW.id, api_response.status, api_response.content;
      END IF;
      
    EXCEPTION WHEN OTHERS THEN
      -- No fallar la transacción si el email falla
      RAISE WARNING 'Error en trigger de email para disputa %: %', NEW.id, SQLERRM;
    END;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Crear trigger que se ejecute DESPUÉS de UPDATE
DROP TRIGGER IF EXISTS trigger_send_dispute_email ON question_disputes;

CREATE TRIGGER trigger_send_dispute_email
  AFTER UPDATE ON question_disputes
  FOR EACH ROW
  EXECUTE FUNCTION send_dispute_email_notification();

-- 4. Configurar variable de entorno para la URL base (opcional)
-- ALTER DATABASE postgres SET app.base_url = 'https://www.vence.es';

-- 5. Test del sistema (comentado por seguridad)
/*
-- Para probar, puedes ejecutar:
UPDATE question_disputes 
SET status = 'resolved', 
    admin_response = 'Prueba de email automático'
WHERE id = (SELECT id FROM question_disputes LIMIT 1);
*/

-- Información del trigger
SELECT 
  schemaname,
  tablename,
  triggername,
  definition
FROM pg_triggers 
WHERE triggername = 'trigger_send_dispute_email';