-- mobile-error-analysis.sql
-- ANÁLISIS ESPECÍFICO DE ERRORES MÓVILES EN NOTIFICACIONES PUSH

-- 1. ERRORES ESPECÍFICOS POR DISPOSITIVO MÓVIL
SELECT 
  device_info->>'deviceType' as device_type,
  browser_info->>'name' as browser,
  error_details->>'message' as error_message,
  error_details->>'name' as error_name,
  notification_data->>'errorType' as error_type,
  COUNT(*) as error_count,
  STRING_AGG(DISTINCT user_agent, CHR(10)) as user_agents,
  MAX(created_at) as last_occurrence
FROM notification_events 
WHERE error_details IS NOT NULL 
  AND device_info->>'deviceType' LIKE '%mobile%'
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY device_type, browser, error_message, error_name, error_type
ORDER BY error_count DESC;

-- 2. FLUJO COMPLETO CON ERRORES - MÓVILES QUE FALLAN
WITH mobile_journeys AS (
  SELECT 
    user_id,
    device_info->>'deviceType' as device_type,
    browser_info->>'name' as browser_name,
    created_at::date as event_date,
    
    -- Eventos del flujo
    ARRAY_AGG(
      CONCAT(created_at::time, ' - ', event_type, 
        CASE 
          WHEN error_details IS NOT NULL THEN ' (ERROR: ' || (error_details->>'message') || ')'
          WHEN notification_data->>'action' IS NOT NULL THEN ' (' || (notification_data->>'action') || ')'
          ELSE ''
        END
      ) ORDER BY created_at
    ) as event_timeline,
    
    -- Contadores
    COUNT(CASE WHEN event_type = 'permission_requested' THEN 1 END) as permission_requests,
    COUNT(CASE WHEN event_type = 'permission_granted' THEN 1 END) as permissions_granted,
    COUNT(CASE WHEN event_type = 'settings_updated' THEN 1 END) as setups_completed,
    COUNT(CASE WHEN error_details IS NOT NULL THEN 1 END) as total_errors,
    
    -- Tipo de errores específicos
    STRING_AGG(
      DISTINCT CASE 
        WHEN error_details IS NOT NULL THEN error_details->>'message'
      END, 
      ' | '
    ) as error_messages

  FROM notification_events 
  WHERE device_info->>'deviceType' LIKE '%mobile%'
    AND created_at >= CURRENT_DATE - INTERVAL '3 days'
    AND user_id IS NOT NULL
  GROUP BY user_id, device_type, browser_name, event_date
)
SELECT 
  device_type,
  browser_name,
  event_date,
  total_errors,
  error_messages,
  event_timeline,
  CASE 
    WHEN setups_completed > 0 THEN '✅ Success'
    WHEN total_errors > 0 THEN '❌ Failed'
    ELSE '⏳ Incomplete'
  END as final_status
FROM mobile_journeys
WHERE total_errors > 0 OR setups_completed = 0  -- Solo casos problemáticos
ORDER BY event_date DESC, total_errors DESC;

-- 3. ANÁLISIS DE LA NOTIFICACIÓN DE BIENVENIDA EN MÓVILES
SELECT 
  device_info->>'deviceType' as device_type,
  browser_info->>'name' as browser,
  notification_data->>'notificationType' as notification_type,
  event_type,
  error_details->>'message' as error_message,
  COUNT(*) as count,
  MAX(created_at) as last_occurrence
FROM notification_events 
WHERE device_info->>'deviceType' LIKE '%mobile%'
  AND (
    notification_data->>'notificationType' = 'welcome' 
    OR notification_data->>'action' LIKE '%welcome%'
    OR event_type = 'notification_delivered'
    OR event_type = 'notification_failed'
  )
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY device_type, browser, notification_type, event_type, error_message
ORDER BY count DESC;

-- 4. COMPARACIÓN: MÓVILES QUE FUNCIONAN VS MÓVILES QUE FALLAN
WITH mobile_success_analysis AS (
  SELECT 
    user_id,
    device_info->>'deviceType' as device_type,
    browser_info->>'name' as browser_name,
    
    -- Indicadores de éxito
    COUNT(CASE WHEN event_type = 'permission_granted' THEN 1 END) > 0 as has_permission_granted,
    COUNT(CASE WHEN event_type = 'settings_updated' AND notification_data->>'action' = 'setup_completed_successfully' THEN 1 END) > 0 as has_setup_completed,
    COUNT(CASE WHEN event_type = 'notification_delivered' AND notification_data->>'notificationType' = 'welcome' THEN 1 END) > 0 as has_welcome_shown,
    
    -- Indicadores de fallo
    COUNT(CASE WHEN error_details IS NOT NULL THEN 1 END) as error_count,
    
    -- Detalles de errores
    STRING_AGG(DISTINCT error_details->>'message', ' | ') as error_summary

  FROM notification_events 
  WHERE device_info->>'deviceType' LIKE '%mobile%'
    AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    AND user_id IS NOT NULL
  GROUP BY user_id, device_type, browser_name
)
SELECT 
  device_type,
  browser_name,
  
  -- Casos exitosos
  COUNT(CASE WHEN has_setup_completed AND has_welcome_shown AND error_count = 0 THEN 1 END) as fully_successful,
  COUNT(CASE WHEN has_setup_completed AND error_count = 0 THEN 1 END) as setup_successful,
  COUNT(CASE WHEN has_permission_granted AND error_count = 0 THEN 1 END) as permission_successful,
  
  -- Casos fallidos
  COUNT(CASE WHEN error_count > 0 THEN 1 END) as failed_cases,
  COUNT(CASE WHEN NOT has_permission_granted THEN 1 END) as permission_failed,
  COUNT(CASE WHEN has_permission_granted AND NOT has_setup_completed THEN 1 END) as setup_failed,
  COUNT(CASE WHEN has_setup_completed AND NOT has_welcome_shown THEN 1 END) as welcome_failed,
  
  -- Errores más comunes
  MODE() WITHIN GROUP (ORDER BY error_summary) as most_common_error,
  
  COUNT(*) as total_users

FROM mobile_success_analysis
GROUP BY device_type, browser_name
ORDER BY failed_cases DESC, total_users DESC;

-- 5. QUERY SIMPLE PARA VER ERRORES RECIENTES EN MÓVILES
SELECT 
  created_at::time as time,
  device_info->>'deviceType' as device,
  browser_info->>'name' as browser,
  event_type,
  error_details->>'message' as error,
  notification_data->>'action' as action,
  user_agent
FROM notification_events 
WHERE device_info->>'deviceType' LIKE '%mobile%'
  AND created_at >= NOW() - INTERVAL '1 hour'
  AND (error_details IS NOT NULL OR event_type = 'notification_failed')
ORDER BY created_at DESC
LIMIT 20;