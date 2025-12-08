import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findViewsAndFunctions() {
  console.log('🔍 BUSCANDO VISTAS Y FUNCIONES QUE CALCULEN RACHAS\n')
  console.log('='.repeat(60))

  // 1. Buscar VISTAS
  console.log('📊 VISTAS EN LA BASE DE DATOS:')
  const { data: views } = await supabase
    .from('information_schema.views')
    .select('table_name, view_definition')
    .eq('table_schema', 'public')

  if (views) {
    console.log(`Encontradas ${views.length} vistas`)

    // Buscar vistas relacionadas con rachas
    const relevantViews = views.filter(v =>
      v.table_name.includes('streak') ||
      v.table_name.includes('racha') ||
      v.table_name.includes('user') ||
      v.view_definition?.toLowerCase().includes('streak') ||
      v.view_definition?.toLowerCase().includes('consecutive')
    )

    if (relevantViews.length > 0) {
      console.log('\n✅ Vistas potencialmente relevantes:')
      relevantViews.forEach(v => {
        console.log(`  - ${v.table_name}`)
      })
    } else {
      console.log('\nVistas existentes:')
      views.forEach(v => {
        console.log(`  - ${v.table_name}`)
      })
    }
  }

  // 2. Buscar FUNCIONES que devuelven rachas
  console.log('\n📌 FUNCIONES QUE PODRÍAN CALCULAR RACHAS:')
  const { data: functions } = await supabase
    .from('information_schema.routines')
    .select('routine_name, data_type')
    .eq('routine_schema', 'public')
    .eq('routine_type', 'FUNCTION')

  if (functions) {
    console.log(`Encontradas ${functions.length} funciones`)

    // Filtrar funciones que podrían estar relacionadas
    const relevantFunctions = functions.filter(f =>
      f.routine_name.includes('user') ||
      f.routine_name.includes('streak') ||
      f.routine_name.includes('racha') ||
      f.routine_name.includes('stat') ||
      f.routine_name.includes('activity') ||
      f.routine_name.includes('consecutive')
    )

    if (relevantFunctions.length > 0) {
      console.log('\n✅ Funciones potencialmente relevantes:')
      relevantFunctions.forEach(f => {
        console.log(`  - ${f.routine_name} (returns: ${f.data_type})`)
      })
    } else {
      console.log('\nPrimeras 20 funciones:')
      functions.slice(0, 20).forEach(f => {
        console.log(`  - ${f.routine_name}`)
      })
    }
  }

  // 3. Verificar si user_streaks es una vista materializada
  console.log('\n📌 VERIFICANDO SI user_streaks ES UNA VISTA:')

  const { data: tableInfo } = await supabase
    .from('information_schema.tables')
    .select('table_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'user_streaks')
    .single()

  if (tableInfo) {
    console.log(`user_streaks es: ${tableInfo.table_type}`)
    if (tableInfo.table_type === 'VIEW') {
      console.log('¡ES UNA VISTA! Se calcula dinámicamente')
    } else if (tableInfo.table_type === 'BASE TABLE') {
      console.log('Es una tabla normal (no una vista)')
    }
  }

  // 4. Buscar vistas materializadas
  console.log('\n📌 VISTAS MATERIALIZADAS:')
  const { data: matViews } = await supabase
    .from('pg_matviews')
    .select('matviewname')

  if (matViews && matViews.length > 0) {
    console.log(`Encontradas ${matViews.length} vistas materializadas:`)
    matViews.forEach(v => {
      console.log(`  - ${v.matviewname}`)
    })
  } else {
    console.log('No hay vistas materializadas o no se puede acceder')
  }

  console.log('\n' + '='.repeat(60))
  console.log('💡 CONCLUSIÓN:')
  console.log('Si user_streaks es una tabla normal y no una vista,')
  console.log('debe actualizarse mediante:')
  console.log('1. Un trigger oculto en la base de datos')
  console.log('2. Un proceso externo (GitHub Actions, Vercel Cron, etc)')
  console.log('3. Supabase Edge Functions con schedule')
  console.log('4. Actualización manual periódica')
}

findViewsAndFunctions().catch(console.error)