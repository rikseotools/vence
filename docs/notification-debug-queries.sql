-- docs/notification-debug-queries.sql
-- QUERIES PARA DEBUGGING DE NOTIFICACIONES PUSH

-- 1. RESUMEN GENERAL DE EVENTOS POR DISPOSITIVO (ÚLTIMOS 7 DÍAS)
SELECT 
  event_type,
  device_info->>'deviceType' as device_type,
  browser_info->>'name' as browser_name,
  browser_info->>'version' as browser_version,
  COUNT(*) as total_events,
  COUNT(CASE WHEN error_details IS NOT NULL THEN 1 END) as error_count,
  ROUND(
    COUNT(CASE WHEN error_details IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric * 100, 
    2
  ) as error_rate_percentage,
  MIN(created_at) as first_event,
  MAX(created_at) as last_event
FROM notification_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY event_type, device_type, browser_name, browser_version
ORDER BY device_type, error_rate_percentage DESC, total_events DESC;

-- 2. ANÁLISIS ESPECÍFICO DE ERRORES POR DISPOSITIVO MÓVIL VS DESKTOP
SELECT 
  CASE 
    WHEN device_info->>'deviceType' IN ('ios_mobile', 'android_mobile', 'mobile') THEN 'Mobile'
    WHEN device_info->>'deviceType' IN ('ios_tablet', 'android_tablet', 'tablet') THEN 'Tablet'
    ELSE 'Desktop'
  END as device_category,
  event_type,
  error_details->>'message' as error_message,
  error_details->>'name' as error_name,
  COUNT(*) as error_count,
  STRING_AGG(DISTINCT browser_info->>'name', ', ') as affected_browsers,
  MAX(created_at) as last_occurrence
FROM notification_events 
WHERE error_details IS NOT NULL 
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY device_category, event_type, error_message, error_name
ORDER BY device_category, error_count DESC;

-- 3. ANÁLISIS DE FLUJO COMPLETO: DESDE CLICK HASTA ÉXITO/ERROR (ACTUALIZADO)
WITH user_journeys AS (
  SELECT 
    user_id,
    device_info->>'deviceType' as device_type,
    browser_info->>'name' as browser_name,
    DATE(created_at) as event_date,
    
    -- Contar cada paso del proceso usando los event_types correctos
    COUNT(CASE WHEN event_type = 'permission_requested' AND notification_data->>'action' = 'activation_button_clicked' THEN 1 END) as clicks_activar,
    COUNT(CASE WHEN event_type = 'permission_requested' THEN 1 END) as permisos_solicitados,
    COUNT(CASE WHEN event_type = 'permission_granted' THEN 1 END) as permisos_otorgados,
    COUNT(CASE WHEN event_type = 'permission_denied' THEN 1 END) as permisos_denegados,
    COUNT(CASE WHEN event_type = 'subscription_created' THEN 1 END) as suscripciones_creadas,
    COUNT(CASE WHEN event_type = 'settings_updated' AND notification_data->>'action' = 'setup_completed_successfully' THEN 1 END) as configuraciones_exitosas,
    COUNT(CASE WHEN event_type = 'notification_failed' THEN 1 END) as configuraciones_fallidas,
    
    -- Errores específicos
    COUNT(CASE WHEN event_type = 'permission_denied' AND error_details->>'message' LIKE '%not supported%' THEN 1 END) as navegador_no_soportado,
    COUNT(CASE WHEN event_type = 'notification_failed' AND error_details->>'message' LIKE '%subscription%' THEN 1 END) as errores_suscripcion
    
  FROM notification_events 
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY user_id, device_type, browser_name, event_date
)
SELECT 
  device_type,
  browser_name,
  
  -- Métricas de éxito
  SUM(clicks_activar) as total_clicks_activar,
  SUM(configuraciones_exitosas) as total_configuraciones_exitosas,
  ROUND(
    SUM(configuraciones_exitosas)::numeric / NULLIF(SUM(clicks_activar), 0)::numeric * 100, 
    2
  ) as tasa_exito_percentage,
  
  -- Puntos de fallo
  SUM(permisos_denegados) as total_permisos_denegados,
  SUM(configuraciones_fallidas) as total_configuraciones_fallidas,
  SUM(navegador_no_soportado) as total_navegador_no_soportado,
  SUM(errores_suscripcion) as total_errores_suscripcion,
  
  -- Usuarios únicos afectados
  COUNT(DISTINCT CASE WHEN clicks_activar > 0 THEN user_id END) as usuarios_intentaron,
  COUNT(DISTINCT CASE WHEN configuraciones_exitosas > 0 THEN user_id END) as usuarios_exitosos

FROM user_journeys
GROUP BY device_type, browser_name
ORDER BY tasa_exito_percentage ASC, total_clicks_activar DESC;

-- 4. ERRORES DETALLADOS CON CONTEXTO COMPLETO (PARA DEBUGGING)
SELECT 
  created_at,
  event_type,
  device_info->>'deviceType' as device_type,
  browser_info->>'name' as browser_name,
  browser_info->>'version' as browser_version,
  
  -- Información específica del error
  error_details->>'message' as error_message,
  error_details->>'name' as error_name,
  error_details->>'currentPermission' as current_permission,
  error_details->'apiSupport'->>'serviceWorker' as sw_supported,
  error_details->'apiSupport'->>'pushManager' as pm_supported,
  error_details->'apiSupport'->>'notification' as notification_supported,
  
  -- Información del dispositivo móvil
  device_info->'mobileInfo'->>'isStandalone' as is_pwa,
  device_info->'mobileInfo'->>'isTouchDevice' as is_touch,
  device_info->'mobileInfo'->>'screenOrientation' as orientation,
  device_info->'mobileInfo'->>'pixelRatio' as pixel_ratio,
  
  -- User agent completo para análisis manual
  user_agent,
  
  -- Tiempo de respuesta (si aplica)
  response_time_ms

FROM notification_events 
WHERE error_details IS NOT NULL 
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 50;

-- 5. ANÁLISIS TEMPORAL: CUÁNDO OCURREN MÁS ERRORES
SELECT 
  DATE_TRUNC('hour', created_at) as hour_bucket,
  device_info->>'deviceType' as device_type,
  COUNT(*) as total_events,
  COUNT(CASE WHEN error_details IS NOT NULL THEN 1 END) as error_events,
  ROUND(
    COUNT(CASE WHEN error_details IS NOT NULL THEN 1 END)::numeric / COUNT(*)::numeric * 100, 
    2
  ) as error_rate_percentage
FROM notification_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '2 days'
GROUP BY hour_bucket, device_type
HAVING COUNT(*) >= 5  -- Solo horas con actividad significativa
ORDER BY hour_bucket DESC, error_rate_percentage DESC;

-- 6. COMPARACIÓN ESPECÍFICA: IOS VS ANDROID VS DESKTOP
WITH device_stats AS (
  SELECT 
    CASE 
      WHEN device_info->>'deviceType' LIKE 'ios_%' THEN 'iOS'
      WHEN device_info->>'deviceType' LIKE 'android_%' THEN 'Android'
      WHEN device_info->>'deviceType' = 'desktop' THEN 'Desktop'
      ELSE 'Other'
    END as platform,
    
    -- Eventos clave
    COUNT(CASE WHEN event_type = 'activation_button_clicked' THEN 1 END) as clicks_activar,
    COUNT(CASE WHEN event_type = 'setup_completed_successfully' THEN 1 END) as configuraciones_exitosas,
    COUNT(CASE WHEN event_type = 'setup_failed' THEN 1 END) as configuraciones_fallidas,
    COUNT(CASE WHEN event_type = 'permission_denied' THEN 1 END) as permisos_denegados,
    COUNT(CASE WHEN event_type = 'browser_not_supported' THEN 1 END) as navegador_no_soportado,
    
    -- Usuarios únicos
    COUNT(DISTINCT user_id) as usuarios_unicos
    
  FROM notification_events 
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY platform
)
SELECT 
  platform,
  clicks_activar,
  configuraciones_exitosas,
  configuraciones_fallidas,
  permisos_denegados,
  navegador_no_soportado,
  usuarios_unicos,
  
  -- Tasas de éxito
  ROUND(
    configuraciones_exitosas::numeric / NULLIF(clicks_activar, 0)::numeric * 100, 
    2
  ) as tasa_exito_percentage,
  
  -- Tasa de errores
  ROUND(
    configuraciones_fallidas::numeric / NULLIF(clicks_activar, 0)::numeric * 100, 
    2
  ) as tasa_error_percentage

FROM device_stats
ORDER BY tasa_exito_percentage DESC;

-- 7. USUARIOS ESPECÍFICOS CON PROBLEMAS RECURRENTES
SELECT 
  user_id,
  device_info->>'deviceType' as device_type,
  browser_info->>'name' as browser_name,
  COUNT(*) as total_eventos,
  COUNT(CASE WHEN event_type = 'activation_button_clicked' THEN 1 END) as intentos_activacion,
  COUNT(CASE WHEN error_details IS NOT NULL THEN 1 END) as errores_totales,
  STRING_AGG(DISTINCT event_type, ', ' ORDER BY event_type) as tipos_eventos,
  MIN(created_at) as primer_intento,
  MAX(created_at) as ultimo_intento
FROM notification_events 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
  AND user_id IS NOT NULL
GROUP BY user_id, device_type, browser_name
HAVING COUNT(CASE WHEN event_type = 'activation_button_clicked' THEN 1 END) > 1  -- Múltiples intentos
   AND COUNT(CASE WHEN event_type = 'setup_completed_successfully' THEN 1 END) = 0  -- Sin éxito
ORDER BY errores_totales DESC, intentos_activacion DESC
LIMIT 20;

-- 8. QUERY PARA VER EVENTOS EN TIEMPO REAL (PARA MONITORING)
SELECT 
  created_at,
  event_type,
  device_info->>'deviceType' as device,
  browser_info->>'name' as browser,
  notification_data->>'action' as action,
  CASE 
    WHEN error_details IS NOT NULL THEN '❌ ' || (error_details->>'message')
    ELSE '✅ OK'
  END as status,
  user_id
FROM notification_events 
WHERE created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 100;

-- 9. QUERY SIMPLE PARA TESTING INMEDIATO
SELECT 
  created_at::time as time,
  event_type,
  device_info->>'deviceType' as device,
  notification_data->>'action' as action,
  error_details->>'message' as error
FROM notification_events 
WHERE created_at >= NOW() - INTERVAL '10 minutes'
ORDER BY created_at DESC;