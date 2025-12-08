// Analizar patrones de estudio de múltiples usuarios para definir criterios fiables
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function analyzeUserPattern(userId, userName) {
  try {
    // Obtener todos los tests completados
    const { data: tests } = await supabase
      .from('tests')
      .select('id')
      .eq('user_id', userId)
      .eq('is_completed', true)

    if (!tests || tests.length === 0) {
      console.log(`${userName}: Sin tests completados\n`)
      return null
    }

    // Obtener todas las preguntas
    const { data: questions } = await supabase
      .from('test_questions')
      .select('tema_number, article_id')
      .in('test_id', tests.map(t => t.id))

    if (!questions || questions.length === 0) {
      console.log(`${userName}: Sin preguntas\n`)
      return null
    }

    // Análisis
    const totalPreguntas = questions.length
    const conArticulo = questions.filter(q => q.article_id !== null).length
    const tema0 = questions.filter(q => q.tema_number === 0 || q.tema_number === null).length
    const temasUnicos = new Set(questions.map(q => q.tema_number).filter(t => t !== null && t !== 0))
    const articulosUnicos = new Set(questions.filter(q => q.article_id).map(q => q.article_id))

    const porcentajeTema0 = Math.round((tema0 / totalPreguntas) * 100)
    const porcentajeConArticulo = Math.round((conArticulo / totalPreguntas) * 100)
    const concentracion = conArticulo > 0 ? (conArticulo / articulosUnicos.size).toFixed(1) : 0

    const result = {
      nombre: userName,
      totalPreguntas,
      tests: tests.length,
      tema0Porcentaje: porcentajeTema0,
      articuloPorcentaje: porcentajeConArticulo,
      temasUnicos: temasUnicos.size,
      articulosUnicos: articulosUnicos.size,
      concentracion
    }

    console.log(`📊 ${userName}`)
    console.log(`   Tests: ${tests.length}`)
    console.log(`   Preguntas: ${totalPreguntas}`)
    console.log(`   Tema 0 (aleatorio): ${porcentajeTema0}%`)
    console.log(`   Con article_id: ${porcentajeConArticulo}%`)
    console.log(`   Temas únicos: ${temasUnicos.size}`)
    console.log(`   Artículos únicos: ${articulosUnicos.size}`)
    console.log(`   Concentración: ${concentracion} preguntas/artículo`)

    // Clasificación
    let clasificacion = ''
    if (temasUnicos.size > 1) {
      clasificacion = '📚 ESTUDIA POR TEMAS'
    } else if (porcentajeTema0 > 80 && porcentajeConArticulo > 70) {
      clasificacion = '⚖️ ESTUDIA POR LEYES/ARTÍCULOS'
    } else {
      clasificacion = '🎲 TESTS ALEATORIOS'
    }
    console.log(`   → ${clasificacion}`)
    console.log('')

    return result

  } catch (err) {
    console.error(`Error analizando ${userName}:`, err)
    return null
  }
}

async function analyzeMultipleUsers() {
  console.log('🔍 Analizando patrones de estudio de usuarios...\n')
  console.log('═'.repeat(60))
  console.log('')

  const usuarios = [
    { id: '7194d681-0047-47da-8d2f-45634b2605a1', nombre: 'Inma Corcuera' },
    { id: '60798ede-09d3-49b9-ad1e-712201d2169c', nombre: 'David' },
  ]

  // Obtener algunos usuarios más activos
  const { data: activeUsers } = await supabase
    .from('user_streaks')
    .select('user_id, current_streak')
    .order('current_streak', { ascending: false })
    .limit(10)

  if (activeUsers) {
    for (const user of activeUsers) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.user_id)
        .single()

      if (profile && !usuarios.find(u => u.id === user.user_id)) {
        usuarios.push({ id: user.user_id, nombre: profile.full_name || 'Usuario' })
      }
    }
  }

  const resultados = []

  for (const usuario of usuarios) {
    const resultado = await analyzeUserPattern(usuario.id, usuario.nombre)
    if (resultado) {
      resultados.push(resultado)
    }
  }

  console.log('═'.repeat(60))
  console.log('📈 RESUMEN DE PATRONES')
  console.log('═'.repeat(60))
  console.log('')

  const porLeyes = resultados.filter(r =>
    r.tema0Porcentaje > 80 && r.articuloPorcentaje > 70
  )
  const porTemas = resultados.filter(r => r.temasUnicos > 1)
  const aleatorios = resultados.filter(r =>
    r.tema0Porcentaje > 80 && r.articuloPorcentaje <= 70
  )

  console.log(`⚖️ Estudian por leyes/artículos: ${porLeyes.length}`)
  porLeyes.forEach(r => console.log(`   - ${r.nombre} (${r.articuloPorcentaje}% con artículos)`))

  console.log(`\n📚 Estudian por temas: ${porTemas.length}`)
  porTemas.forEach(r => console.log(`   - ${r.nombre} (${r.temasUnicos} temas)`))

  console.log(`\n🎲 Tests aleatorios: ${aleatorios.length}`)
  aleatorios.forEach(r => console.log(`   - ${r.nombre} (${r.articuloPorcentaje}% con artículos)`))

  console.log('\n═'.repeat(60))
  console.log('💡 CRITERIOS SUGERIDOS:')
  console.log('═'.repeat(60))
  console.log('')
  console.log('1. Estudia por TEMAS: temas_unicos > 1')
  console.log('2. Estudia por LEYES: tema_0 > 80% Y article_id > 70%')
  console.log('3. Tests ALEATORIOS: resto de casos')
  console.log('')
}

analyzeMultipleUsers()
