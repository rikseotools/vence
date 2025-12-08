import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function findStreakMechanism() {
  console.log('🔍 BUSCANDO MECANISMO DE ACTUALIZACIÓN DE RACHAS\n')
  console.log('='.repeat(60))

  // 1. Buscar triggers en la base de datos
  console.log('📌 BUSCANDO TRIGGERS:')

  // Query para buscar triggers
  const triggerQuery = `
    SELECT
      tgname as trigger_name,
      tgrelid::regclass as table_name,
      proname as function_name
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE tgrelid::regclass::text IN ('user_streaks', 'tests', 'test_questions')
    OR proname LIKE '%streak%'
    OR proname LIKE '%racha%'
  `

  try {
    const { data: triggers, error } = await supabase
      .from('pg_trigger')
      .select('*')

    if (error) {
      console.log('No se pudo acceder a pg_trigger directamente')
    } else {
      console.log('Triggers encontrados:', triggers?.length || 0)
    }
  } catch (e) {
    console.log('Buscando de otra forma...')
  }

  // 2. Buscar funciones relacionadas con streaks
  console.log('\n📌 BUSCANDO FUNCIONES:')

  // Buscar en el esquema de información
  const { data: functions } = await supabase
    .from('information_schema.routines')
    .select('routine_name, routine_type')
    .or('routine_name.ilike.%streak%,routine_name.ilike.%racha%')

  if (functions && functions.length > 0) {
    console.log('Funciones encontradas:')
    functions.forEach(f => {
      console.log(`  - ${f.routine_name} (${f.routine_type})`)
    })
  } else {
    console.log('No se encontraron funciones con "streak" o "racha" en el nombre')
  }

  // 3. Analizar cómo se podría estar actualizando
  console.log('\n📌 POSIBLES MECANISMOS DE ACTUALIZACIÓN:')
  console.log('1. Trigger en insert de test_questions')
  console.log('2. Función llamada desde el backend')
  console.log('3. Cron job o proceso batch')
  console.log('4. Actualización manual desde el frontend')

  // 4. Verificar si hay referencias en el código
  console.log('\n📌 VERIFICANDO ACTUALIZACIONES DESDE EL CÓDIGO:')

  // Buscar actualizaciones recientes en user_streaks
  const { data: recentUpdates } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak, updated_at, last_activity_date')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (recentUpdates) {
    console.log('\nÚltimas actualizaciones de rachas:')
    recentUpdates.forEach(update => {
      const updated = update.updated_at ? new Date(update.updated_at) : 'Sin fecha'
      console.log(`  - Racha: ${update.current_streak} días, Actualizado: ${updated}`)
    })
  }

  // 5. Propuesta de optimización
  console.log('\n💡 PROPUESTA DE OPTIMIZACIÓN:')
  console.log('\nOPCIÓN 1: Actualización incremental (más eficiente)')
  console.log('- Al completar test: incrementar current_streak si es día nuevo')
  console.log('- Revisar solo último día de actividad, no recalcular todo')
  console.log('- Mantener campo last_activity_date actualizado')

  console.log('\nOPCIÓN 2: Cálculo on-demand (menos escrituras)')
  console.log('- No guardar rachas, calcular cuando se necesite')
  console.log('- Usar vista materializada que se refresca cada hora')
  console.log('- Cachear resultado en Redis/memoria')

  console.log('\nOPCIÓN 3: Trigger optimizado')
  console.log('- Trigger que solo mira últimos 2 días (para día de gracia)')
  console.log('- Si hay actividad hoy o ayer, incrementar')
  console.log('- Si no, resetear a 1')
  console.log('- No necesita revisar 60+ días de historial')
}

findStreakMechanism().catch(console.error)