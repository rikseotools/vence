// Verificar qué triggers están activos en la base de datos
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { execSync } from 'child_process'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 Verificando triggers activos en la base de datos...\n')

// Extraer credenciales de la URL de Supabase
const dbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const projectRef = dbUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]

if (!projectRef) {
  console.error('❌ No se pudo extraer el project ref de la URL')
  process.exit(1)
}

console.log(`📊 Project: ${projectRef}\n`)
console.log('⚠️ Para ver los triggers, ejecuta estos comandos en SQL Editor de Supabase:\n')

console.log('-- 1. Ver TODOS los triggers en la tabla tests:')
console.log(`
SELECT
  trigger_name,
  event_object_table,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'tests'
ORDER BY trigger_name;
`)

console.log('\n-- 2. Ver si existe el trigger update_streak_on_test:')
console.log(`
SELECT
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name LIKE '%streak%';
`)

console.log('\n-- 3. Ver la definición de cualquier función que actualice user_streaks:')
console.log(`
SELECT
  routine_name,
  routine_type,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_definition LIKE '%user_streaks%'
    OR routine_name LIKE '%streak%'
  )
ORDER BY routine_name;
`)

console.log('\n-- 4. Ver específicamente la función que usa el trigger:')
console.log(`
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname LIKE '%streak%';
`)

console.log('\n📝 Copia estas queries y ejecútalas en Supabase SQL Editor:')
console.log(`https://supabase.com/dashboard/project/${projectRef}/sql/new\n`)
