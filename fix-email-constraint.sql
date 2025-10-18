-- Fix para constraint de email_events que bloquea 'bienvenida_inmediato'
-- Error: violates check constraint "email_events_email_type_check"

-- 1. Eliminar constraint existente
ALTER TABLE email_events DROP CONSTRAINT IF EXISTS email_events_email_type_check;

-- 2. Crear nuevo constraint con 'bienvenida_inmediato' incluido
ALTER TABLE email_events ADD CONSTRAINT email_events_email_type_check 
CHECK (email_type IN (
    'welcome', 
    'reactivation', 
    'urgent_reactivation', 
    'motivation', 
    'achievement', 
    'streak_danger', 
    'newsletter', 
    'system',
    'bienvenida_inmediato'
));

-- Verificar que el constraint se aplicó correctamente
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'email_events_email_type_check';