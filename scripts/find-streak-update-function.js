import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findStreakFunction() {
  console.log('🔍 BUSCANDO FUNCIÓN DE ACTUALIZACIÓN DE RACHAS\n')
  console.log('='.repeat(60))

  // Buscar la función update_user_streak
  const query = `
    SELECT
      proname as function_name,
      pg_get_functiondef(oid) as function_definition
    FROM pg_proc
    WHERE proname LIKE '%streak%'
    OR proname LIKE '%racha%'
  `

  const { data, error } = await supabase.rpc('sql_query', { query })
    .catch(() => {
      // Si no existe sql_query, intentar directamente
      return { data: null, error: 'sql_query not found' }
    })

  if (error) {
    console.log('No se pudo usar sql_query, buscando de otra forma...')

    // Intentar buscar en información schema
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('*')
      .or('routine_name.ilike.%streak%,routine_name.ilike.%racha%')

    if (funcError) {
      console.error('Error buscando funciones:', funcError)
      return
    }

    if (functions && functions.length > 0) {
      console.log('Funciones encontradas:')
      functions.forEach(f => {
        console.log(`  - ${f.routine_name}`)
      })
    }
  } else if (data) {
    console.log('Funciones encontradas:')
    data.forEach(f => {
      console.log(`\n📌 ${f.function_name}`)
      if (f.function_definition) {
        // Buscar si hay límite de 60
        if (f.function_definition.includes('60')) {
          console.log('  ⚠️ CONTIENE REFERENCIA A 60')
          const lines = f.function_definition.split('\n')
          lines.forEach((line, i) => {
            if (line.includes('60')) {
              console.log(`  Línea ${i}: ${line.trim()}`)
            }
          })
        }
      }
    })
  }

  // También buscar triggers
  console.log('\n🔄 BUSCANDO TRIGGERS DE RACHAS:')
  const triggerQuery = `
    SELECT
      tgname as trigger_name,
      tgrelid::regclass as table_name,
      pg_get_triggerdef(oid) as trigger_definition
    FROM pg_trigger
    WHERE tgname LIKE '%streak%'
    OR tgname LIKE '%racha%'
  `

  const { data: triggers } = await supabase.rpc('sql_query', { query: triggerQuery })
    .catch(() => ({ data: null }))

  if (triggers) {
    triggers.forEach(t => {
      console.log(`\n📌 Trigger: ${t.trigger_name}`)
      console.log(`   Tabla: ${t.table_name}`)
      if (t.trigger_definition && t.trigger_definition.includes('60')) {
        console.log('   ⚠️ CONTIENE REFERENCIA A 60')
      }
    })
  }
}

findStreakFunction().catch(console.error)