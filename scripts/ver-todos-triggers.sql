-- VER TODOS LOS TRIGGERS EN LA BASE DE DATOS

SELECT
  trigger_name as "Nombre del Trigger",
  event_object_table as "Tabla",
  event_manipulation as "Evento",
  action_timing as "Cuando",
  action_orientation as "Por",
  action_statement as "Función que ejecuta"
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;