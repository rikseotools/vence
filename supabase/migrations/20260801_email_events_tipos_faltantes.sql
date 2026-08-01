-- 20260801_email_events_tipos_faltantes.sql
--
-- Cerrar el hueco que dejaba correos REALES sin rastro. [T-448 / T-456]
--
-- `logEmailSent` escribe en `email_logs` y en `email_events` con un `Promise.all` dentro de un
-- try/catch que se traga el error. La columna `email_events.email_type` tiene un CHECK con lista
-- blanca, así que un tipo que no esté en ella **no da error a nadie**: la fila de `email_logs`
-- entra igual y la de `email_events` no. El correo sale, y para toda la observabilidad no ha
-- existido.
--
-- Medido el 01/08/2026: los 8 envíos de `fin_suscripcion_precio_heredado` de las 09:00 UTC
-- dejaron 8 filas en `email_logs` y CERO en `email_events`. El guardarraíl
-- `emailEventsTiposAceptados` ya había declarado los dos huecos como deuda conocida ese mismo
-- día; esta migración es lo que permite quitarlos de esa lista, que solo puede encoger.
--
-- Solo AMPLÍA la lista blanca: todas las filas existentes la cumplen por construcción, así que
-- no puede rechazar nada que hoy esté guardado. Se recrea en dos pasos (`NOT VALID` + `VALIDATE`)
-- para no tomar un bloqueo largo sobre una tabla que está en el camino de cada envío.

ALTER TABLE public.email_events
  DROP CONSTRAINT IF EXISTS email_events_email_type_check;

ALTER TABLE public.email_events
  ADD CONSTRAINT email_events_email_type_check
  CHECK (email_type = ANY (ARRAY[
    'welcome', 'reactivation', 'urgent_reactivation', 'motivation', 'achievement',
    'streak_danger', 'newsletter', 'system', 'bienvenida_inmediato', 'impugnacion_respuesta',
    'soporte_respuesta', 'reactivacion', 'urgente', 'bienvenida_motivacional',
    'resumen_semanal', 'topic_unlock', 'medal_congratulation', 'modal_articulos_mejora',
    'mejoras_producto', 'lanzamiento_premium', 'recordatorio_renovacion', 'pago_fallido',
    'admin_notification', 'newsletter_oposicion',
    -- Añadidos 01/08/2026: la app ya los envía y la BD los rechazaba en silencio.
    'nueva_oposicion',
    'fin_suscripcion_precio_heredado'
  ]::text[]))
  NOT VALID;

ALTER TABLE public.email_events
  VALIDATE CONSTRAINT email_events_email_type_check;
