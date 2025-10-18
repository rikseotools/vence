-- Fix para el timing del trigger de impugnaciones
-- El trigger puede estar ejecutándose antes que la transacción se propague

-- Modificar la función para usar pg_sleep y asegurar propagación
CREATE OR REPLACE FUNCTION send_dispute_email_notification()
RETURNS TRIGGER AS $$
DECLARE
  api_url TEXT;
  api_response http_response;
BEGIN
  -- Solo enviar email si el status cambió y es resolved o rejected
  IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status IN ('resolved', 'rejected')) THEN
    
    -- URL del API endpoint
    api_url := COALESCE(
      current_setting('app.base_url', true),
      'https://www.vence.es'
    ) || '/api/send-dispute-email';
    
    -- Log detallado para debugging
    RAISE LOG 'TRIGGER DEBUG: Disputa ID %, OLD status: %, NEW status: %', 
      NEW.id, OLD.status, NEW.status;
    RAISE LOG 'TRIGGER DEBUG: admin_response presente: %, resolved_at: %', 
      (NEW.admin_response IS NOT NULL), NEW.resolved_at;
    
    -- Pequeño delay para asegurar propagación de la transacción
    PERFORM pg_sleep(0.1);
    
    -- Llamar al endpoint API
    BEGIN
      SELECT * INTO api_response FROM http_post(
        api_url,
        json_build_object('disputeId', NEW.id)::text,
        'application/json'
      );
      
      -- Log detallado del resultado
      RAISE LOG 'TRIGGER DEBUG: API Status: %, Response: %', 
        api_response.status, LEFT(api_response.content, 200);
      
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

-- El trigger ya existe, no necesita recrearse