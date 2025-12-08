import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function deepInvestigation() {
  console.log('🔍 INVESTIGACIÓN PROFUNDA DEL SISTEMA DE RACHAS\n')
  console.log('='.repeat(70))

  // 1. BUSCAR TODOS LOS TRIGGERS
  console.log('\n1️⃣ BUSCANDO TODOS LOS TRIGGERS EN LA BD:')
  console.log('-'.repeat(50))

  try {
    // Intentar query directo para obtener triggers
    const triggerQuery = `
      SELECT
        schemaname,
        tablename,
        triggername,
        definition
      FROM pg_triggers
      WHERE schemaname = 'public'
    `

    const { data: pgTriggers, error: triggerError } = await supabase
      .from('pg_triggers')
      .select('*')

    if (!triggerError && pgTriggers) {
      console.log(`Encontrados ${pgTriggers.length} triggers`)
      pgTriggers.forEach(t => {
        console.log(`  - ${t.triggername} en tabla ${t.tablename}`)
      })
    }
  } catch (e) {
    console.log('No se puede acceder a pg_triggers directamente')
  }

  // 2. BUSCAR EN INFORMACIÓN SCHEMA
  console.log('\n2️⃣ BUSCANDO FUNCIONES/PROCEDIMIENTOS:')
  console.log('-'.repeat(50))

  const { data: routines } = await supabase
    .from('information_schema.routines')
    .select('routine_name, routine_type, routine_schema')
    .eq('routine_schema', 'public')

  if (routines) {
    console.log(`Encontradas ${routines.length} rutinas`)

    // Filtrar las que podrían estar relacionadas con rachas
    const relevantRoutines = routines.filter(r =>
      r.routine_name.toLowerCase().includes('streak') ||
      r.routine_name.toLowerCase().includes('racha') ||
      r.routine_name.toLowerCase().includes('update_user') ||
      r.routine_name.toLowerCase().includes('test') ||
      r.routine_name.toLowerCase().includes('activity')
    )

    if (relevantRoutines.length > 0) {
      console.log('\n  Rutinas potencialmente relevantes:')
      relevantRoutines.forEach(r => {
        console.log(`  ✓ ${r.routine_name} (${r.routine_type})`)
      })
    } else {
      console.log('  ❌ No se encontraron rutinas con palabras clave relevantes')
      console.log('\n  Mostrando todas las rutinas:')
      routines.slice(0, 20).forEach(r => {
        console.log(`  - ${r.routine_name}`)
      })
      if (routines.length > 20) {
        console.log(`  ... y ${routines.length - 20} más`)
      }
    }
  }

  // 3. ANALIZAR CUÁNDO SE ACTUALIZA user_streaks
  console.log('\n3️⃣ ANALIZANDO ACTUALIZACIONES DE user_streaks:')
  console.log('-'.repeat(50))

  const { data: recentStreaks } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, last_activity_date, updated_at')
    .not('updated_at', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(10)

  if (recentStreaks && recentStreaks.length > 0) {
    console.log('Últimas actualizaciones:')
    recentStreaks.forEach(s => {
      const updated = s.updated_at ? new Date(s.updated_at).toLocaleString() : 'Sin fecha'
      console.log(`  - Racha: ${s.current_streak}, Actualizado: ${updated}`)
    })

    // Verificar patrón de actualización
    const updateTimes = recentStreaks
      .filter(s => s.updated_at)
      .map(s => new Date(s.updated_at))

    if (updateTimes.length > 1) {
      const timeDiffs = []
      for (let i = 1; i < updateTimes.length; i++) {
        timeDiffs.push(updateTimes[i-1] - updateTimes[i])
      }
      console.log('\n  Patrón de tiempo entre actualizaciones:')
      console.log(`  Promedio: ${Math.round(timeDiffs.reduce((a,b) => a+b, 0) / timeDiffs.length / 1000 / 60)} minutos`)
    }
  } else {
    console.log('  ❌ No hay campo updated_at o no hay datos recientes')
  }

  // 4. BUSCAR EN API/BACKEND
  console.log('\n4️⃣ BUSCANDO EN CÓDIGO DE API:')
  console.log('-'.repeat(50))

  // Verificar si hay una API route
  console.log('  Posibles lugares donde se actualiza:')
  console.log('  - pages/api/...')
  console.log('  - app/api/...')
  console.log('  - Funciones Edge de Supabase')
  console.log('  - Triggers de base de datos')
  console.log('  - Cron jobs externos')

  // 5. VERIFICAR SI HAY POLÍTICAS RLS
  console.log('\n5️⃣ VERIFICANDO POLÍTICAS RLS EN user_streaks:')
  console.log('-'.repeat(50))

  const { data: policies } = await supabase
    .from('information_schema.table_privileges')
    .select('*')
    .eq('table_name', 'user_streaks')
    .eq('table_schema', 'public')

  if (policies && policies.length > 0) {
    console.log(`  Encontradas ${policies.length} políticas/privilegios`)
    policies.forEach(p => {
      console.log(`  - ${p.privilege_type} para ${p.grantee}`)
    })
  }

  // 6. RASTREAR LLAMADAS EN TEST_QUESTIONS
  console.log('\n6️⃣ RASTREANDO INSERCIONES EN test_questions:')
  console.log('-'.repeat(50))

  const { data: recentQuestions } = await supabase
    .from('test_questions')
    .select('created_at, test_id')
    .order('created_at', { ascending: false })
    .limit(5)

  if (recentQuestions) {
    console.log('Últimas preguntas insertadas:')
    recentQuestions.forEach(q => {
      console.log(`  - ${new Date(q.created_at).toLocaleString()}`)
    })

    console.log('\n  💡 Si las rachas se actualizan al mismo tiempo que estas inserciones,')
    console.log('     entonces hay un TRIGGER en test_questions o tests')
  }

  // 7. CONCLUSIÓN
  console.log('\n7️⃣ HIPÓTESIS BASADA EN LA INVESTIGACIÓN:')
  console.log('-'.repeat(50))
  console.log('\n  Basado en lo encontrado, el sistema de rachas probablemente:')
  console.log('  1. Se actualiza mediante un TRIGGER (no visible en queries normales)')
  console.log('  2. El trigger tiene un límite de 60 días en su lógica')
  console.log('  3. Se ejecuta al insertar en test_questions o tests')
  console.log('\n  Para confirmarlo, necesitamos:')
  console.log('  - Acceso directo a pg_proc y pg_trigger')
  console.log('  - O revisar el historial de migraciones de Supabase')
  console.log('  - O buscar en archivos de migración SQL')
}

deepInvestigation().catch(console.error)