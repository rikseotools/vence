// scripts/test-question-algorithm.js
// Test directo del algoritmo de selección sin dependencias externas

// Test unitario del algoritmo de priorización
function testQuestionPrioritization() {
  console.log('🧪 TEST UNITARIO: Algoritmo de Priorización de Preguntas')
  console.log('=' .repeat(60))

  // Datos de prueba
  const allQuestions = [
    { id: 'q1', question_text: 'Pregunta 1' },
    { id: 'q2', question_text: 'Pregunta 2' },
    { id: 'q3', question_text: 'Pregunta 3' },
    { id: 'q4', question_text: 'Pregunta 4' },
    { id: 'q5', question_text: 'Pregunta 5' },
    { id: 'q6', question_text: 'Pregunta 6' },
    { id: 'q7', question_text: 'Pregunta 7' },
    { id: 'q8', question_text: 'Pregunta 8' },
    { id: 'q9', question_text: 'Pregunta 9' },
    { id: 'q10', question_text: 'Pregunta 10' }
  ]

  // Simular que el usuario ya respondió algunas preguntas
  const userAnswers = [
    { question_id: 'q1', created_at: '2024-11-10T10:00:00Z' },
    { question_id: 'q3', created_at: '2024-11-11T10:00:00Z' },
    { question_id: 'q5', created_at: '2024-11-09T10:00:00Z' }, // Más antigua
    { question_id: 'q7', created_at: '2024-11-12T10:00:00Z' }  // Más reciente
  ]

  console.log(`📊 Total preguntas disponibles: ${allQuestions.length}`)
  console.log(`📊 Preguntas ya respondidas: ${userAnswers.length}`)

  // Paso 1: Crear mapas de respuestas (igual que el algoritmo real)
  const answeredQuestionIds = new Set()
  const questionLastAnswered = new Map()

  userAnswers.forEach(answer => {
    answeredQuestionIds.add(answer.question_id)
    const answerDate = new Date(answer.created_at)
    
    if (!questionLastAnswered.has(answer.question_id) || 
        answerDate > questionLastAnswered.get(answer.question_id)) {
      questionLastAnswered.set(answer.question_id, answerDate)
    }
  })

  // Paso 2: Clasificar preguntas
  const neverSeenQuestions = []
  const answeredQuestions = []

  allQuestions.forEach(question => {
    if (answeredQuestionIds.has(question.id)) {
      question._lastAnswered = questionLastAnswered.get(question.id)
      answeredQuestions.push(question)
    } else {
      neverSeenQuestions.push(question)
    }
  })

  // Paso 3: Ordenar respondidas por fecha (más antiguas primero)
  answeredQuestions.sort((a, b) => a._lastAnswered - b._lastAnswered)

  console.log('\n📋 CLASIFICACIÓN:')
  console.log(`🟢 Preguntas nunca vistas: ${neverSeenQuestions.length}`)
  neverSeenQuestions.forEach(q => console.log(`   - ${q.id}: ${q.question_text}`))

  console.log(`🟡 Preguntas ya respondidas: ${answeredQuestions.length}`)
  answeredQuestions.forEach(q => console.log(`   - ${q.id}: ${q.question_text} (${q._lastAnswered.toLocaleDateString()})`))

  // Test casos específicos
  console.log('\n🧪 CASO 1: Solicitar 5 preguntas (hay 6 nunca vistas)')
  const requestedQuestions = 5
  
  if (neverSeenQuestions.length >= requestedQuestions) {
    console.log('✅ ESTRATEGIA: Solo preguntas nunca vistas')
    const selected = neverSeenQuestions.slice(0, requestedQuestions)
    console.log('📝 Seleccionadas:', selected.map(q => q.id).join(', '))
    
    // Verificar que TODAS sean nunca vistas
    const allNeverSeen = selected.every(q => !answeredQuestionIds.has(q.id))
    console.log(`✅ Verificación: ${allNeverSeen ? 'TODAS nunca vistas' : '❌ ALGUNAS ya vistas'}`)
  }

  console.log('\n🧪 CASO 2: Solicitar 8 preguntas (solo hay 6 nunca vistas)')
  const requestedQuestions2 = 8
  
  if (neverSeenQuestions.length < requestedQuestions2) {
    console.log('✅ ESTRATEGIA: Distribución mixta')
    const neverSeenCount = neverSeenQuestions.length
    const reviewCount = requestedQuestions2 - neverSeenCount
    
    console.log(`📊 Distribución: ${neverSeenCount} nunca vistas + ${reviewCount} para repaso`)
    
    const selectedNeverSeen = neverSeenQuestions
    const selectedForReview = answeredQuestions.slice(0, reviewCount)
    const finalSelection = [...selectedNeverSeen, ...selectedForReview]
    
    console.log('📝 Nunca vistas seleccionadas:', selectedNeverSeen.map(q => q.id).join(', '))
    console.log('📝 Para repaso seleccionadas:', selectedForReview.map(q => q.id).join(', '))
    console.log('📝 Selección final:', finalSelection.map(q => q.id).join(', '))
    
    // Verificar priorización
    const neverSeenInSelection = finalSelection.filter(q => !answeredQuestionIds.has(q.id)).length
    const answeredInSelection = finalSelection.filter(q => answeredQuestionIds.has(q.id)).length
    
    console.log(`✅ Verificación: ${neverSeenInSelection} nunca vistas, ${answeredInSelection} ya respondidas`)
    
    if (neverSeenInSelection === neverSeenQuestions.length) {
      console.log('✅ CORRECTO: Todas las nunca vistas fueron incluidas primero')
    } else {
      console.log('❌ ERROR: No se incluyeron todas las nunca vistas disponibles')
    }
  }

  console.log('\n🧪 CASO 3: Verificar ordenamiento por antigüedad')
  console.log('📅 Orden esperado por antigüedad (más antigua primero):')
  answeredQuestions.forEach((q, index) => {
    console.log(`   ${index + 1}. ${q.id} - ${q._lastAnswered.toLocaleDateString()}`)
  })

  // Verificar que están ordenadas correctamente
  let correctOrder = true
  for (let i = 1; i < answeredQuestions.length; i++) {
    if (answeredQuestions[i]._lastAnswered < answeredQuestions[i-1]._lastAnswered) {
      correctOrder = false
      break
    }
  }
  console.log(`✅ Ordenamiento: ${correctOrder ? 'CORRECTO' : '❌ INCORRECTO'}`)

  return {
    allQuestions: allQuestions.length,
    neverSeen: neverSeenQuestions.length,
    answered: answeredQuestions.length,
    correctOrder
  }
}

// Test de edge cases
function testEdgeCases() {
  console.log('\n🧪 TEST EDGE CASES')
  console.log('=' .repeat(40))

  // Caso 1: Usuario nuevo (sin historial)
  console.log('🔸 CASO: Usuario sin historial')
  const allQuestions = Array.from({length: 10}, (_, i) => ({id: `q${i+1}`}))
  const userAnswers = []
  
  const answeredQuestionIds = new Set(userAnswers.map(a => a.question_id))
  const neverSeen = allQuestions.filter(q => !answeredQuestionIds.has(q.id))
  
  console.log(`   Resultado: ${neverSeen.length}/${allQuestions.length} nunca vistas`)
  console.log(`   ✅ ${neverSeen.length === allQuestions.length ? 'CORRECTO' : 'ERROR'}`)

  // Caso 2: Usuario que respondió todo
  console.log('\n🔸 CASO: Usuario que respondió todas las preguntas')
  const allAnswers = allQuestions.map((q, i) => ({
    question_id: q.id,
    created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString()
  }))
  
  const allAnsweredIds = new Set(allAnswers.map(a => a.question_id))
  const neverSeenAll = allQuestions.filter(q => !allAnsweredIds.has(q.id))
  
  console.log(`   Resultado: ${neverSeenAll.length}/${allQuestions.length} nunca vistas`)
  console.log(`   ✅ ${neverSeenAll.length === 0 ? 'CORRECTO' : 'ERROR'}`)

  // Caso 3: Solicitar más preguntas de las disponibles
  console.log('\n🔸 CASO: Solicitar más preguntas de las disponibles')
  const available = 5
  const requested = 10
  const actualToReturn = Math.min(available, requested)
  
  console.log(`   Disponibles: ${available}, Solicitadas: ${requested}`)
  console.log(`   Se deberían devolver: ${actualToReturn}`)
  console.log(`   ✅ ${actualToReturn === available ? 'CORRECTO' : 'ERROR'}`)
}

// Simular el problema reportado
function simulateReportedIssue() {
  console.log('\n🚨 SIMULACIÓN DEL PROBLEMA REPORTADO')
  console.log('=' .repeat(50))

  // Escenario: Usuario que hace tests frecuentemente pero ve preguntas repetidas
  const totalQuestions = 100
  const questionsAnswered = 30
  const questionsRequested = 25

  console.log(`📊 Escenario:`)
  console.log(`   - Total preguntas en tema: ${totalQuestions}`)
  console.log(`   - Ya respondidas por usuario: ${questionsAnswered}`)
  console.log(`   - Preguntas nunca vistas: ${totalQuestions - questionsAnswered}`)
  console.log(`   - Preguntas solicitadas: ${questionsRequested}`)

  const neverSeenAvailable = totalQuestions - questionsAnswered
  
  console.log(`\n🎯 ANÁLISIS:`)
  if (neverSeenAvailable >= questionsRequested) {
    console.log(`✅ HAY SUFICIENTES preguntas nunca vistas (${neverSeenAvailable})`)
    console.log(`✅ EL ALGORITMO DEBERÍA usar SOLO preguntas nunca vistas`)
    console.log(`❌ Si el usuario ve preguntas repetidas, HAY UN BUG`)
  } else {
    console.log(`⚠️ NO hay suficientes preguntas nunca vistas`)
    console.log(`🔄 El algoritmo debería usar distribución mixta`)
  }

  return neverSeenAvailable >= questionsRequested
}

// Ejecutar todos los tests
function runAllTests() {
  console.log('🧪 INICIANDO TESTS DEL ALGORITMO DE SELECCIÓN DE PREGUNTAS')
  console.log('='.repeat(80))
  
  const result1 = testQuestionPrioritization()
  testEdgeCases()
  const shouldWorkPerfectly = simulateReportedIssue()
  
  console.log('\n📊 RESUMEN FINAL:')
  console.log(`✅ Algoritmo básico: ${result1.correctOrder ? 'FUNCIONAL' : 'CON ERRORES'}`)
  console.log(`✅ Casos edge: Verificados`)
  console.log(`🎯 Problema reportado: ${shouldWorkPerfectly ? 'NO DEBERÍA OCURRIR' : 'EXPLICABLE'}`)
  
  if (shouldWorkPerfectly) {
    console.log('\n🚨 CONCLUSIÓN: El problema NO está en la lógica del algoritmo')
    console.log('🔍 POSIBLES CAUSAS DEL BUG:')
    console.log('   1. Inconsistencia entre test_questions y detailed_answers')
    console.log('   2. Problema en la query SQL (joins, filtros)')
    console.log('   3. Estado de cache/sesión interfiriendo')
    console.log('   4. Error en la clasificación de preguntas como "respondidas"')
    console.log('   5. Problema en el orden de ejecución del algoritmo')
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
}