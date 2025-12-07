import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeTest2() {
  // Primero obtener Nila
  const { data: profiles } = await supabase
    .from('public_user_profiles')
    .select('id, display_name')

  const nilaProfile = profiles?.find(p => p.display_name?.toLowerCase().includes('nila'))
  if (!nilaProfile) {
    console.log('❌ Usuario Nila no encontrado')
    return
  }

  const userId = nilaProfile.id

  // Obtener tests de hoy
  const todayUTC = new Date()
  todayUTC.setUTCHours(0, 0, 0, 0)
  const todayUTCEnd = new Date(todayUTC)
  todayUTCEnd.setUTCHours(23, 59, 59, 999)

  const { data: tests } = await supabase
    .from('tests')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', todayUTC.toISOString())
    .lte('created_at', todayUTCEnd.toISOString())
    .order('created_at', { ascending: true })

  if (!tests || tests.length < 2) {
    console.log('❌ No se encontraron 2 tests hoy')
    return
  }

  const test = tests[1] // Segundo test

  console.log('🔍 ANÁLISIS DEL TEST 2 (debería tener 25 preguntas):\n')
  console.log('ID completo:', test.id)
  console.log('Usuario:', test.user_id)
  console.log('Creado:', test.created_at)
  console.log('Estado:', test.status || 'undefined')
  console.log('Completado:', test.is_completed || 'undefined')
  console.log('Tema:', test.tema_id || 'N/A')
  console.log('Ley:', test.law_id || 'N/A')
  console.log('Config:', JSON.stringify(test.config || {}, null, 2))
  console.log('')

  const { data: questions } = await supabase
    .from('test_questions')
    .select('*')
    .eq('test_id', test.id)
    .order('created_at')

  console.log('📊 Preguntas guardadas:', questions.length)

  if (questions.length > 0) {
    console.log('Primera pregunta:', questions[0].created_at)
    console.log('Última pregunta:', questions[questions.length - 1].created_at)

    const timeFirst = new Date(questions[0].created_at)
    const timeLast = new Date(questions[questions.length - 1].created_at)
    const duration = (timeLast - timeFirst) / 1000 / 60 // minutos

    console.log(`Duración total: ${duration.toFixed(2)} minutos`)
    console.log(`Promedio por pregunta: ${(duration / questions.length).toFixed(2)} minutos`)
  }

  console.log('')

  if (questions.length < 25) {
    console.log(`⚠️  PROBLEMA: Solo ${questions.length} preguntas guardadas de 25 esperadas`)
    console.log(`Faltan: ${25 - questions.length} preguntas\n`)

    console.log('Posibles causas:')
    console.log('  1. El usuario abandonó el test después de', questions.length, 'preguntas')
    console.log('  2. Hubo un error al guardar las últimas', 25 - questions.length, 'preguntas')
    console.log('  3. El test se configuró con', questions.length, 'preguntas (no 25)')
  }
}

analyzeTest2()
