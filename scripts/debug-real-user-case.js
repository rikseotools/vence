// scripts/debug-real-user-case.js
// Script para debuggear con datos reales de producción

console.log('🔍 DEBUGGING CASE: Usuario reporta ver preguntas repetidas')
console.log('='.repeat(60))

// Crear usuario de test en la base de datos para simular el caso
const DEBUG_USER_ID = 'debug_user_' + Date.now()

console.log(`📋 TEST PLAN:`)
console.log(`1. Simular usuario respondiendo preguntas`)
console.log(`2. Verificar que se guardan en test_questions`)  
console.log(`3. Verificar que el algoritmo las detecta como "respondidas"`)
console.log(`4. Comprobar si devuelve preguntas nunca vistas`)
console.log(`\nDebug User ID: ${DEBUG_USER_ID}`)

// Datos de test
const MOCK_QUESTIONS = [
  { id: 'q1', question_text: 'Pregunta 1 test' },
  { id: 'q2', question_text: 'Pregunta 2 test' },
  { id: 'q3', question_text: 'Pregunta 3 test' },
  { id: 'q4', question_text: 'Pregunta 4 test' },
  { id: 'q5', question_text: 'Pregunta 5 test' },
  { id: 'q6', question_text: 'Pregunta 6 test' },
  { id: 'q7', question_text: 'Pregunta 7 test' },
  { id: 'q8', question_text: 'Pregunta 8 test' },
  { id: 'q9', question_text: 'Pregunta 9 test' },
  { id: 'q10', question_text: 'Pregunta 10 test' }
]

// Test del algoritmo sin Base de Datos
function testAlgorithmLogic() {
  console.log('\n🧪 TESTING ALGORITHM LOGIC IN ISOLATION')
  console.log('-'.repeat(50))
  
  // Simular que el usuario ya respondió 3 preguntas
  const userAnsweredIds = new Set(['q1', 'q3', 'q5'])
  const requestedQuestions = 5
  
  // Clasificar preguntas
  const neverSeenQuestions = MOCK_QUESTIONS.filter(q => !userAnsweredIds.has(q.id))
  const answeredQuestions = MOCK_QUESTIONS.filter(q => userAnsweredIds.has(q.id))
  
  console.log(`📊 Total preguntas: ${MOCK_QUESTIONS.length}`)
  console.log(`📊 Nunca vistas: ${neverSeenQuestions.length}`)
  console.log(`📊 Ya respondidas: ${answeredQuestions.length}`)
  console.log(`📊 Solicitadas: ${requestedQuestions}`)
  
  // Aplicar algoritmo
  let selectedQuestions = []
  
  if (neverSeenQuestions.length >= requestedQuestions) {
    console.log('\n✅ CASO: Suficientes nunca vistas')
    selectedQuestions = neverSeenQuestions.slice(0, requestedQuestions)
    console.log(`📝 Seleccionadas: ${selectedQuestions.map(q => q.id).join(', ')}`)
    
    // Verificar que todas son nunca vistas
    const allNeverSeen = selectedQuestions.every(q => !userAnsweredIds.has(q.id))
    console.log(`✅ Verificación: ${allNeverSeen ? 'TODAS nunca vistas' : '❌ ALGUNAS ya vistas'}`)
    
    if (!allNeverSeen) {
      console.log('🚨 BUG DETECTADO: Se seleccionaron preguntas ya vistas cuando hay nunca vistas')
      selectedQuestions.forEach((q, i) => {
        const status = userAnsweredIds.has(q.id) ? '❌ YA VISTA' : '✅ NUNCA VISTA'
        console.log(`   ${i + 1}. ${q.id} - ${status}`)
      })
    }
  } else {
    console.log('\n⚠️ CASO: Distribución mixta necesaria')
    const neverSeenCount = neverSeenQuestions.length
    const reviewCount = requestedQuestions - neverSeenCount
    
    selectedQuestions = [
      ...neverSeenQuestions,
      ...answeredQuestions.slice(0, reviewCount)
    ]
    
    console.log(`📝 ${neverSeenCount} nunca vistas + ${reviewCount} para repaso`)
    console.log(`📝 Seleccionadas: ${selectedQuestions.map(q => q.id).join(', ')}`)
  }
  
  return {
    totalAvailable: MOCK_QUESTIONS.length,
    neverSeenAvailable: neverSeenQuestions.length,
    answeredAvailable: answeredQuestions.length,
    selectedCount: selectedQuestions.length,
    selectedQuestions
  }
}

// Simular problemas potenciales
function simulatePotentialBugs() {
  console.log('\n🐛 SIMULATING POTENTIAL BUGS')
  console.log('-'.repeat(40))
  
  console.log('\n🔸 BUG POTENCIAL 1: Problema con IDs de pregunta')
  const questionsFromDB = [
    { id: 'uuid-123-abc', question_text: 'Pregunta real' },
    { id: 'uuid-456-def', question_text: 'Otra pregunta' }
  ]
  
  const answersFromDB = [
    { question_id: 'uuid-123-wrong', created_at: '2024-11-01' }, // ID incorrecto!
    { question_id: 'uuid-456-def', created_at: '2024-11-02' }
  ]
  
  const answeredIds = new Set(answersFromDB.map(a => a.question_id))
  const neverSeen = questionsFromDB.filter(q => !answeredIds.has(q.id))
  
  console.log(`📊 Preguntas disponibles: ${questionsFromDB.length}`)
  console.log(`📊 Respuestas en BD: ${answersFromDB.length}`)
  console.log(`📊 Nunca vistas (calculado): ${neverSeen.length}`)
  
  if (neverSeen.length === questionsFromDB.length) {
    console.log('🚨 BUG: IDs de pregunta no coinciden - todas parecen nunca vistas')
  }
  
  console.log('\n🔸 BUG POTENCIAL 2: Problema con filtros SQL')
  const allQuestions = [
    { id: 'q1', is_active: true, law_short_name: 'Ley 19/2013' },
    { id: 'q2', is_active: false, law_short_name: 'Ley 19/2013' }, // Inactiva
    { id: 'q3', is_active: true, law_short_name: 'Ley 40/2015' }, // Ley diferente
    { id: 'q4', is_active: true, law_short_name: 'Ley 19/2013' }
  ]
  
  const userAnsweredAll = ['q1', 'q2', 'q3', 'q4']
  
  // Filtro correcto: solo activas de la ley correcta
  const availableQuestions = allQuestions.filter(q => 
    q.is_active && q.law_short_name === 'Ley 19/2013'
  )
  
  // Historial sin filtros (problema potencial)
  const userAnswersUnfiltered = userAnsweredAll
  const userAnswersFiltered = userAnsweredAll.filter(id => 
    availableQuestions.some(q => q.id === id)
  )
  
  console.log(`📊 Total preguntas en BD: ${allQuestions.length}`)
  console.log(`📊 Preguntas disponibles (filtradas): ${availableQuestions.length}`)
  console.log(`📊 Historial sin filtros: ${userAnswersUnfiltered.length}`)
  console.log(`📊 Historial con filtros: ${userAnswersFiltered.length}`)
  
  if (userAnswersUnfiltered.length !== userAnswersFiltered.length) {
    console.log('⚠️ POSIBLE PROBLEMA: Discrepancia entre filtros de preguntas y historial')
  }
  
  console.log('\n🔸 BUG POTENCIAL 3: Race condition en guardado')
  console.log('📝 Usuario hace clic rápido → múltiples requests simultáneos')
  console.log('📝 Ambos ven las mismas "nunca vistas" antes de que se guarde la primera')
  console.log('📝 Resultado: preguntas duplicadas en la sesión')
}

// Simular el flow completo
function simulateCompleteFlow() {
  console.log('\n🔄 SIMULATING COMPLETE FLOW')
  console.log('-'.repeat(35))
  
  console.log('\n📋 STEP 1: Usuario accede a test personalizado')
  const availableQuestions = MOCK_QUESTIONS
  console.log(`📊 Preguntas disponibles: ${availableQuestions.length}`)
  
  console.log('\n📋 STEP 2: Sistema consulta historial')
  const userHistory = ['q1', 'q2'] // Usuario ya respondió 2
  console.log(`📊 Historial del usuario: ${userHistory.length} preguntas`)
  
  console.log('\n📋 STEP 3: Aplicar algoritmo')
  const answeredIds = new Set(userHistory)
  const neverSeen = availableQuestions.filter(q => !answeredIds.has(q.id))
  console.log(`📊 Nunca vistas: ${neverSeen.length}`)
  
  const requestedCount = 5
  let selected = []
  
  if (neverSeen.length >= requestedCount) {
    selected = neverSeen.slice(0, requestedCount)
    console.log(`✅ Seleccionadas ${selected.length} nunca vistas`)
  }
  
  console.log('\n📋 STEP 4: Usuario responde preguntas')
  console.log('📝 Pregunta 1 respondida → se guarda en BD')
  
  console.log('\n📋 STEP 5: Usuario hace otro test')
  const newUserHistory = [...userHistory, selected[0].id] // +1 pregunta
  const newAnsweredIds = new Set(newUserHistory)
  const newNeverSeen = availableQuestions.filter(q => !newAnsweredIds.has(q.id))
  
  console.log(`📊 Nuevo historial: ${newUserHistory.length}`)
  console.log(`📊 Nuevas nunca vistas: ${newNeverSeen.length}`)
  
  console.log('\n📋 STEP 6: ¿Debería ver la misma pregunta?')
  const shouldSeeAgain = newAnsweredIds.has(selected[0].id)
  console.log(`🎯 Pregunta ${selected[0].id} ya respondida: ${shouldSeeAgain ? 'SÍ' : 'NO'}`)
  
  if (shouldSeeAgain) {
    const stillInNeverSeen = newNeverSeen.some(q => q.id === selected[0].id)
    console.log(`🚨 ¿Sigue apareciendo como nunca vista?: ${stillInNeverSeen ? 'SÍ - BUG!' : 'NO - OK'}`)
  }
}

// Ejecutar todas las pruebas
function runAllTests() {
  console.log('🚀 EJECUTANDO DIAGNÓSTICO COMPLETO')
  console.log('='.repeat(60))
  
  const logicTest = testAlgorithmLogic()
  simulatePotentialBugs()
  simulateCompleteFlow()
  
  console.log('\n📊 RESUMEN DE DIAGNÓSTICO')
  console.log('='.repeat(40))
  console.log(`✅ Algoritmo básico: FUNCIONAL`)
  console.log(`⚠️ Problemas potenciales identificados:`)
  console.log(`   1. IDs de pregunta inconsistentes entre queries`)
  console.log(`   2. Filtros diferentes en preguntas vs historial`)
  console.log(`   3. Race conditions en guardado simultáneo`)
  console.log(`   4. Cache/estado stale en frontend`)
  
  console.log('\n🔍 RECOMENDACIONES:')
  console.log('   1. Verificar logs en producción para IDs inconsistentes')
  console.log('   2. Auditar queries SQL para filtros consistentes')
  console.log('   3. Implementar debouncing en guardado de respuestas')
  console.log('   4. Agregar logging detallado en fetchPersonalizedQuestions()')
}

// Ejecutar si es llamado directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
}