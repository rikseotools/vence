-- Verificar la constraint de email_events
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'email_events'::regclass 
  AND conname LIKE '%email_type%';

-- Ver también la definición de la tabla
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'email_events' 
  AND column_name IN ('email_type', 'template_id');