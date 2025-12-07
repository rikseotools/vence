// Script para verificar si las funciones RPC existen en la base de datos
// Ejecutar: node scripts/verify-rpc-functions.js

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function verifyRpcFunctions() {
  console.log('🔍 VERIFICANDO FUNCIONES RPC\n')

  // Test 1: get_ranking_for_period
  console.log('1️⃣ Testing get_ranking_for_period...')
  const { data: rankingData, error: rankingError } = await supabase.rpc('get_ranking_for_period', {
    p_start_date: '2025-11-22T00:00:00Z',
    p_end_date: '2025-11-22T23:59:59.999Z',
    p_min_questions: 5,
    p_limit: 100
  })

  if (rankingError) {
    console.error('   ❌ ERROR:', rankingError)
  } else {
    console.log(`   ✅ OK - Devuelve ${rankingData?.length || 0} usuarios`)
  }
  console.log()

  // Test 2: get_user_ranking_position (esta es la que falla)
  console.log('2️⃣ Testing get_user_ranking_position...')

  // Primero obtener un user_id válido del ranking
  if (rankingData && rankingData.length > 0) {
    const testUserId = rankingData[0].user_id
    console.log(`   Usando user_id de prueba: ${testUserId.substring(0, 8)}...`)

    const { data: positionData, error: positionError } = await supabase.rpc('get_user_ranking_position', {
      p_user_id: testUserId,
      p_start_date: '2025-11-22T00:00:00Z',
      p_end_date: '2025-11-22T23:59:59.999Z',
      p_min_questions: 5
    })

    if (positionError) {
      console.error('   ❌ ERROR:', positionError)
      console.error('   Detalles completos:', JSON.stringify(positionError, null, 2))
    } else {
      console.log('   ✅ OK - Respuesta:', positionData)
    }
  } else {
    console.log('   ⚠️ No hay usuarios en el ranking para probar')
  }
  console.log()

  // Test 3: Verificar si la función existe en la base de datos
  console.log('3️⃣ Verificando si las funciones existen en pg_proc...')

  const { data: functions, error: funcError } = await supabase
    .from('pg_proc')
    .select('proname')
    .in('proname', ['get_ranking_for_period', 'get_user_ranking_position'])

  if (funcError) {
    console.log('   ⚠️ No se puede acceder a pg_proc (normal si no eres superuser)')
  } else if (functions) {
    console.log('   Funciones encontradas:', functions.map(f => f.proname))
  }
}

verifyRpcFunctions().catch(console.error)
