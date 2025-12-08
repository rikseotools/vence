-- OBTENER TODAS LAS TABLAS DE LA BASE DE DATOS PARA ENTENDER LA APLICACIÓN COMPLETA

-- 1. Listar TODAS las tablas con su tamaño y número de registros
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2. Contar registros en cada tabla (esto puede tardar un poco)
DO $$
DECLARE
    r RECORD;
    count_result INTEGER;
BEGIN
    FOR r IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', r.tablename) INTO count_result;
        RAISE NOTICE '% : % registros', r.tablename, count_result;
    END LOOP;
END $$;

-- 3. Ver todas las tablas agrupadas por categoría/función
SELECT
  CASE
    WHEN tablename LIKE '%user%' THEN '👤 USUARIOS'
    WHEN tablename LIKE '%test%' OR tablename LIKE '%question%' THEN '📝 TESTS'
    WHEN tablename LIKE '%law%' OR tablename LIKE '%article%' THEN '📚 LEYES'
    WHEN tablename LIKE '%topic%' OR tablename LIKE '%tema%' THEN '📖 TEMAS'
    WHEN tablename LIKE '%oposicion%' OR tablename LIKE '%convocatoria%' THEN '🎓 OPOSICIONES'
    WHEN tablename LIKE '%stat%' OR tablename LIKE '%metric%' OR tablename LIKE '%analytics%' THEN '📊 ESTADÍSTICAS'
    WHEN tablename LIKE '%notification%' OR tablename LIKE '%email%' THEN '📧 NOTIFICACIONES'
    WHEN tablename LIKE '%ranking%' OR tablename LIKE '%medal%' OR tablename LIKE '%badge%' THEN '🏆 RANKING'
    WHEN tablename LIKE '%streak%' THEN '🔥 RACHAS'
    WHEN tablename LIKE '%progress%' THEN '📈 PROGRESO'
    WHEN tablename LIKE '%session%' THEN '💻 SESIONES'
    WHEN tablename LIKE '%admin%' THEN '🔧 ADMIN'
    ELSE '📦 OTROS'
  END as categoria,
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY categoria, tablename;

-- 4. Ver relaciones entre tablas (foreign keys)
SELECT
  tc.table_name as tabla_origen,
  kcu.column_name as columna_origen,
  '→' as flecha,
  ccu.table_name AS tabla_destino,
  ccu.column_name AS columna_destino
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- 5. Ver todas las funciones RPC
SELECT
  routine_name,
  routine_type,
  data_type,
  routine_definition IS NOT NULL as has_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 6. Ver todas las vistas
SELECT
  table_name as vista_name,
  view_definition IS NOT NULL as has_definition
FROM information_schema.views
WHERE table_schema = 'public'
ORDER BY table_name;

-- 7. Resumen de la arquitectura
SELECT
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tablas,
  (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION') as total_funciones,
  (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public') as total_vistas,
  (SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema = 'public') as total_triggers;