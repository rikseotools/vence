-- T-601 — un tipo de correo para el aviso que EMPEZAMOS nosotros.
--
-- Las cuatro vías de envío que existían RESPONDEN a algo que la persona escribió antes
-- (impugnación, feedback, newsletter a una lista de inscritos). `soporte_respuesta` significa
-- exactamente eso: la respuesta a un soporte que alguien abrió.
--
-- Falta el caso contrario: escribirle a quien NO ha reclamado, porque hemos detectado nosotros que
-- le pasa algo. Lo estrena `scripts/soporte/avisar-usuario.cjs` con el caso de un usuario que
-- llevaba 19 días sin poder pagar (su banco rechazaba la tarjeta guardada) y que nunca escribió:
-- solo reintentaba.
--
-- Va como tipo PROPIO y no reusando `soporte_respuesta` porque `admin_email_analytics` agrupa por
-- `email_type`: mezclarlos haría que ese cubo signifique dos cosas —lo que contestamos y lo que
-- iniciamos—, y esa es justo la distinción que interesa medir (un aviso proactivo que nadie
-- esperaba tiene otra tasa de apertura, de queja y de baja).
--
-- Additiva: solo AMPLÍA el CHECK. Ninguna fila existente cambia.

ALTER TABLE email_events DROP CONSTRAINT IF EXISTS email_events_email_type_check;

ALTER TABLE email_events ADD CONSTRAINT email_events_email_type_check CHECK (
  email_type = ANY (ARRAY[
    'welcome', 'reactivation', 'urgent_reactivation', 'motivation', 'achievement',
    'streak_danger', 'newsletter', 'system', 'bienvenida_inmediato', 'impugnacion_respuesta',
    'soporte_respuesta', 'reactivacion', 'urgente', 'bienvenida_motivacional', 'resumen_semanal',
    'topic_unlock', 'medal_congratulation', 'modal_articulos_mejora', 'mejoras_producto',
    'lanzamiento_premium', 'recordatorio_renovacion', 'pago_fallido', 'admin_notification',
    'newsletter_oposicion', 'nueva_oposicion', 'fin_suscripcion_precio_heredado',
    -- nuevo (T-601): aviso que iniciamos nosotros, sin que la persona haya reclamado
    'aviso_soporte'
  ]::text[])
);
