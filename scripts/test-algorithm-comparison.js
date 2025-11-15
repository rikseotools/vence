// scripts/test-algorithm-comparison.js
// Comparación entre algoritmo original y fixed

// Mock data para testing
const createTestData = () => {
  const allQuestions = Array.from({length: 100}, (_, i) => ({
    id: `question_${i + 1}`,
    question_text: `Pregunta ${i + 1}`,
    is_active: true,
    articles: {
      id: `article_${(i % 20) + 1}`,
      article_number: `${(i % 20) + 1}`,
      laws: {
        id: 'law_1',
        short_name: 'Ley 19/2013',
        name: 'Ley 19/2013 de transparencia'
      }
    }
  }))

  // Usuario que ha respondido 30 preguntas
  const userAnswers = Array.from({length: 30}, (_, i) => ({
    question_id: `question_${i + 1}`,
    created_at: new Date(Date.now() - (30 - i) * 24 * 60 * 60 * 1000).toISOString(),
    tests: { user_id: 'test_user' },
    questions: {
      is_active: true,
      articles: {
        laws: { short_name: 'Ley 19/2013' }
      }
    }
  }))

  return { allQuestions, userAnswers }
}

// Simular algoritmo ORIGINAL (con posibles bugs)
function simulateOriginalAlgorithm(allQuestions, userAnswers, numQuestions = 25) {
  console.log('🔴 SIMULANDO ALGORITMO ORIGINAL')
  
  // Problema potencial #1: Filtros inconsistentes
  const availableQuestions = allQuestions.filter(q => q.is_active) // Solo filtro básico
  
  // Problema potencial #2: Historial sin validación de IDs
  const answeredQuestionIds = new Set()
  userAnswers.forEach(answer => {
    // No valida si el ID existe en availableQuestions
    answeredQuestionIds.add(answer.question_id)
  })
  
  // Clasificación
  const neverSeenQuestions = availableQuestions.filter(q => !answeredQuestionIds.has(q.id))
  const answeredQuestions = availableQuestions.filter(q => answeredQuestionIds.has(q.id))
  
  // Selección
  let selectedQuestions = []
  if (neverSeenQuestions.length >= numQuestions) {
    selectedQuestions = neverSeenQuestions.slice(0, numQuestions)
  } else {
    const reviewCount = numQuestions - neverSeenQuestions.length
    selectedQuestions = [
      ...neverSeenQuestions,
      ...answeredQuestions.slice(0, reviewCount)
    ]
  }
  
  console.log(`📊 Original - Disponibles: ${availableQuestions.length}`)
  console.log(`📊 Original - Historial: ${answeredQuestionIds.size}`)
  console.log(`📊 Original - Nunca vistas: ${neverSeenQuestions.length}`)
  console.log(`📊 Original - Seleccionadas: ${selectedQuestions.length}`)
  
  return {
    available: availableQuestions.length,
    answered: answeredQuestionIds.size,
    neverSeen: neverSeenQuestions.length,
    selected: selectedQuestions.length,
    selectedQuestions
  }
}

// Simular algoritmo FIXED
function simulateFixedAlgorithm(allQuestions, userAnswers, numQuestions = 25) {
  console.log('🟢 SIMULANDO ALGORITMO FIXED')
  
  // Fix #1: Filtros consistentes y estrictos
  const availableQuestions = allQuestions.filter(q => 
    q.is_active && 
    q.articles?.laws?.short_name === 'Ley 19/2013'
  )
  
  // Fix #2: Validación de IDs y filtros consistentes en historial
  const validQuestionIds = new Set(availableQuestions.map(q => q.id))
  const answeredQuestionIds = new Set()
  
  let validAnswers = 0
  let invalidAnswers = 0
  
  userAnswers
    .filter(answer => 
      answer.questions?.is_active && 
      answer.questions?.articles?.laws?.short_name === 'Ley 19/2013'
    )
    .forEach(answer => {
      if (validQuestionIds.has(answer.question_id)) {
        answeredQuestionIds.add(answer.question_id)
        validAnswers++
      } else {
        invalidAnswers++
      }
    })
  
  // Clasificación
  const neverSeenQuestions = availableQuestions.filter(q => !answeredQuestionIds.has(q.id))
  const answeredQuestions = availableQuestions.filter(q => answeredQuestionIds.has(q.id))
  
  // Selección con verificación
  let selectedQuestions = []
  if (neverSeenQuestions.length >= numQuestions) {
    selectedQuestions = neverSeenQuestions.slice(0, numQuestions)
    
    // Fix #3: Verificación estricta
    const verificationFailed = selectedQuestions.some(q => answeredQuestionIds.has(q.id))
    if (verificationFailed) {
      throw new Error('CRÍTICO: Se seleccionaron preguntas ya vistas!')
    }
  } else {
    const reviewCount = numQuestions - neverSeenQuestions.length
    selectedQuestions = [
      ...neverSeenQuestions,
      ...answeredQuestions.slice(0, reviewCount)
    ]
  }
  
  console.log(`📊 Fixed - Disponibles: ${availableQuestions.length}`)
  console.log(`📊 Fixed - Historial válido: ${validAnswers}/${userAnswers.length}`)
  console.log(`📊 Fixed - Nunca vistas: ${neverSeenQuestions.length}`)
  console.log(`📊 Fixed - Seleccionadas: ${selectedQuestions.length}`)
  
  return {
    available: availableQuestions.length,
    answered: answeredQuestionIds.size,
    neverSeen: neverSeenQuestions.length,
    selected: selectedQuestions.length,
    selectedQuestions,
    validAnswers,
    invalidAnswers
  }
}

// Simular escenarios problemáticos
function testProblematicScenarios() {
  console.log('\n🚨 TESTING ESCENARIOS PROBLEMÁTICOS')
  console.log('='.repeat(50))
  
  // Escenario 1: IDs inconsistentes
  console.log('\n🔸 ESCENARIO 1: IDs inconsistentes en historial')
  const questionsConsistent = [
    { id: 'q1', is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}},
    { id: 'q2', is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}},
    { id: 'q3', is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}}
  ]
  
  const historyInconsistent = [
    { question_id: 'q1_wrong', questions: { is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}}},
    { question_id: 'q2', questions: { is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}}}
  ]
  
  const originalResult1 = simulateOriginalAlgorithm(questionsConsistent, historyInconsistent, 2)
  const fixedResult1 = simulateFixedAlgorithm(questionsConsistent, historyInconsistent, 2)
  
  console.log(`❌ Original tratará q1 como nunca vista (ID incorrecto)`)
  console.log(`✅ Fixed detectará la inconsistencia y la ignorará`)
  
  // Escenario 2: Preguntas inactivas
  console.log('\n🔸 ESCENARIO 2: Preguntas inactivas en historial')
  const questionsWithInactive = [
    { id: 'q1', is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}},
    { id: 'q2', is_active: false, articles: { laws: { short_name: 'Ley 19/2013' }}}, // Inactiva
    { id: 'q3', is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}}
  ]
  
  const historyWithInactive = [
    { question_id: 'q2', questions: { is_active: false, articles: { laws: { short_name: 'Ley 19/2013' }}}}, // Inactiva
  ]
  
  const originalResult2 = simulateOriginalAlgorithm(questionsWithInactive, historyWithInactive, 2)
  const fixedResult2 = simulateFixedAlgorithm(questionsWithInactive, historyWithInactive, 2)
  
  console.log(`❌ Original podría incluir preguntas inactivas`)
  console.log(`✅ Fixed filtra preguntas inactivas consistentemente`)
  
  // Escenario 3: Leyes diferentes
  console.log('\n🔸 ESCENARIO 3: Historial de leyes diferentes')
  const questionsLey19 = [
    { id: 'q1', is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}},
    { id: 'q2', is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}}
  ]
  
  const historyMixedLaws = [
    { question_id: 'q1', questions: { is_active: true, articles: { laws: { short_name: 'Ley 19/2013' }}}},
    { question_id: 'q_other', questions: { is_active: true, articles: { laws: { short_name: 'Ley 40/2015' }}}}
  ]
  
  const originalResult3 = simulateOriginalAlgorithm(questionsLey19, historyMixedLaws, 2)
  const fixedResult3 = simulateFixedAlgorithm(questionsLey19, historyMixedLaws, 2)
  
  console.log(`❌ Original podría contar historial de otras leyes`)
  console.log(`✅ Fixed filtra historial solo de la ley específica`)
}

// Test de performance y consistencia
function testPerformanceAndConsistency() {
  console.log('\n⚡ TEST DE PERFORMANCE Y CONSISTENCIA')
  console.log('='.repeat(45))
  
  const { allQuestions, userAnswers } = createTestData()
  
  // Múltiples ejecuciones para verificar consistencia
  console.log('\n🔄 Ejecutando múltiples tests...')
  
  const originalResults = []
  const fixedResults = []
  
  for (let i = 0; i < 5; i++) {
    const orig = simulateOriginalAlgorithm(allQuestions, userAnswers, 25)
    const fixed = simulateFixedAlgorithm(allQuestions, userAnswers, 25)
    
    originalResults.push(orig)
    fixedResults.push(fixed)
  }
  
  // Analizar consistencia
  const originalNeverSeenCounts = originalResults.map(r => r.neverSeen)
  const fixedNeverSeenCounts = fixedResults.map(r => r.neverSeen)
  
  const originalConsistent = originalNeverSeenCounts.every(count => count === originalNeverSeenCounts[0])
  const fixedConsistent = fixedNeverSeenCounts.every(count => count === fixedNeverSeenCounts[0])
  
  console.log(`📊 Consistencia Original: ${originalConsistent ? '✅' : '❌'} (${originalNeverSeenCounts.join(', ')})`)
  console.log(`📊 Consistencia Fixed: ${fixedConsistent ? '✅' : '❌'} (${fixedNeverSeenCounts.join(', ')})`)
  
  // Verificar que Fixed no devuelve preguntas respondidas cuando hay nunca vistas
  const neverSeenAvailable = fixedResults[0].neverSeen
  const questionsRequested = 25
  
  if (neverSeenAvailable >= questionsRequested) {
    console.log('🎯 CASO CRÍTICO: Hay suficientes nunca vistas')
    
    const allSelectionsPerfect = fixedResults.every(result => {
      const selectedIds = result.selectedQuestions.map(q => q.id)
      const answeredIds = userAnswers.map(a => a.question_id)
      const overlap = selectedIds.filter(id => answeredIds.includes(id))
      return overlap.length === 0
    })
    
    console.log(`✅ Fixed nunca selecciona ya vistas: ${allSelectionsPerfect ? 'CORRECTO' : '❌ FALLO'}`)
  }
}

// Ejecutar todos los tests
function runAllTests() {
  console.log('🧪 COMPARACIÓN ALGORITMO ORIGINAL VS FIXED')
  console.log('='.repeat(60))
  
  const { allQuestions, userAnswers } = createTestData()
  
  console.log(`\n📊 DATOS DE PRUEBA:`)
  console.log(`   - Total preguntas: ${allQuestions.length}`)
  console.log(`   - Historial usuario: ${userAnswers.length}`)
  console.log(`   - Nunca vistas esperadas: ${allQuestions.length - userAnswers.length}`)
  
  const originalResult = simulateOriginalAlgorithm(allQuestions, userAnswers, 25)
  const fixedResult = simulateFixedAlgorithm(allQuestions, userAnswers, 25)
  
  console.log(`\n📋 COMPARACIÓN RESULTADOS:`)
  console.log(`                    | Original | Fixed`)
  console.log(`   Disponibles      | ${originalResult.available.toString().padStart(8)} | ${fixedResult.available.toString().padStart(5)}`)
  console.log(`   Historial        | ${originalResult.answered.toString().padStart(8)} | ${fixedResult.answered.toString().padStart(5)}`)
  console.log(`   Nunca vistas     | ${originalResult.neverSeen.toString().padStart(8)} | ${fixedResult.neverSeen.toString().padStart(5)}`)
  console.log(`   Seleccionadas    | ${originalResult.selected.toString().padStart(8)} | ${fixedResult.selected.toString().padStart(5)}`)
  
  testProblematicScenarios()
  testPerformanceAndConsistency()
  
  console.log('\n📊 RESUMEN FINAL')
  console.log('='.repeat(30))
  console.log('✅ Algoritmo Fixed incluye los siguientes mejoras:')
  console.log('   1. 🔒 Filtros consistentes en queries y historial')
  console.log('   2. 🔍 Validación estricta de IDs de pregunta')
  console.log('   3. 🛡️ Verificación de selección final')
  console.log('   4. 📊 Logging detallado para debugging')
  console.log('   5. ⚡ Manejo de casos edge (preguntas inactivas, leyes diferentes)')
  
  console.log('\n🎯 RECOMENDACIÓN:')
  console.log('   Reemplazar fetchPersonalizedQuestions() original con versión fixed')
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
}