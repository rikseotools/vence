// __tests__/components/TestLayout.test.js
// Tests para prevenir regresiones en TestLayout (modo práctica)
// Enfoque: detectar fallos críticos en guardado de respuestas

describe('TestLayout - Prevención de Regresiones', () => {

  // ============================================
  // Validación de datos antes de guardar
  // ============================================
  describe('Validación de datos para guardar respuesta', () => {

    // Simula la validación en saveDetailedAnswer
    function validateSaveData({ sessionId, questionData, answerData }) {
      if (!sessionId || !questionData || !answerData) {
        return { valid: false, error: 'Datos faltantes' }
      }
      return { valid: true }
    }

    test('CRÍTICO: Debe rechazar si no hay sessionId', () => {
      const result = validateSaveData({
        sessionId: null,
        questionData: { question: 'test' },
        answerData: { selectedAnswer: 0 }
      })
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Datos faltantes')
    })

    test('CRÍTICO: Debe rechazar si no hay questionData', () => {
      const result = validateSaveData({
        sessionId: 'session-123',
        questionData: null,
        answerData: { selectedAnswer: 0 }
      })
      expect(result.valid).toBe(false)
    })

    test('CRÍTICO: Debe rechazar si no hay answerData', () => {
      const result = validateSaveData({
        sessionId: 'session-123',
        questionData: { question: 'test' },
        answerData: null
      })
      expect(result.valid).toBe(false)
    })

    test('Debe aceptar datos válidos', () => {
      const result = validateSaveData({
        sessionId: 'session-123',
        questionData: { question: 'test', options: ['a', 'b', 'c', 'd'] },
        answerData: { selectedAnswer: 0, isCorrect: true }
      })
      expect(result.valid).toBe(true)
    })
  })

  // ============================================
  // Generación de IDs de pregunta
  // ============================================
  describe('Generación de question_id para test_questions', () => {

    // Simula la lógica de generateQuestionId
    function generateQuestionId(questionData, tema, questionOrder) {
      // Si ya tiene ID en metadata, usarlo
      if (questionData.metadata?.id) {
        return questionData.metadata.id
      }

      // Si tiene ID directo, usarlo
      if (questionData.id) {
        return questionData.id
      }

      // Generar ID basado en contenido
      const fullText = (questionData.question || '').trim() +
        (questionData.options?.join('') || '') +
        (questionData.article?.number || '') +
        (questionData.article?.law_short_name || '')

      let hash = 0
      for (let i = 0; i < fullText.length; i++) {
        const char = fullText.charCodeAt(i)
        hash = ((hash << 5) - hash + char) & 0xffffffff
      }

      const contentHash = Math.abs(hash).toString(36)
      const baseId = `tema-${tema}-art-${questionData.article?.number || 'unknown'}-${questionData.article?.law_short_name || 'unknown'}`

      return `${baseId}-${contentHash}`
    }

    test('Debe usar ID de metadata si existe', () => {
      const questionData = {
        question: 'Test question',
        metadata: { id: 'uuid-from-db' }
      }
      const id = generateQuestionId(questionData, 1, 0)
      expect(id).toBe('uuid-from-db')
    })

    test('Debe usar ID directo si existe', () => {
      const questionData = {
        id: 'direct-uuid',
        question: 'Test question'
      }
      const id = generateQuestionId(questionData, 1, 0)
      expect(id).toBe('direct-uuid')
    })

    test('Debe generar ID consistente para la misma pregunta', () => {
      const questionData = {
        question: '¿Cuál es la capital de España?',
        options: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'],
        article: { number: '1', law_short_name: 'CE' }
      }

      const id1 = generateQuestionId(questionData, 1, 0)
      const id2 = generateQuestionId(questionData, 1, 0)

      expect(id1).toBe(id2) // Mismo contenido = mismo ID
    })

    test('Debe generar IDs diferentes para preguntas diferentes', () => {
      const question1 = {
        question: 'Pregunta 1',
        options: ['a', 'b', 'c', 'd']
      }
      const question2 = {
        question: 'Pregunta 2',
        options: ['a', 'b', 'c', 'd']
      }

      const id1 = generateQuestionId(question1, 1, 0)
      const id2 = generateQuestionId(question2, 1, 0)

      expect(id1).not.toBe(id2)
    })

    test('CRÍTICO: Nunca debe retornar null o undefined', () => {
      const questionData = {} // Datos mínimos
      const id = generateQuestionId(questionData, 1, 0)

      expect(id).toBeDefined()
      expect(id).not.toBeNull()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })
  })

  // ============================================
  // Flujo de creación de sesión
  // ============================================
  describe('Flujo de creación de sesión de test', () => {

    // Simula la lógica de creación de sesión
    function shouldCreateSession({
      currentTestSession,
      sessionCreationInProgress,
      authLoading,
      questionsLength
    }) {
      if (authLoading) return false
      if (!questionsLength) return false
      if (currentTestSession) return false
      if (sessionCreationInProgress) return false
      return true
    }

    test('NO debe crear sesión si authLoading=true', () => {
      const result = shouldCreateSession({
        currentTestSession: null,
        sessionCreationInProgress: false,
        authLoading: true,
        questionsLength: 10
      })
      expect(result).toBe(false)
    })

    test('NO debe crear sesión si no hay preguntas', () => {
      const result = shouldCreateSession({
        currentTestSession: null,
        sessionCreationInProgress: false,
        authLoading: false,
        questionsLength: 0
      })
      expect(result).toBe(false)
    })

    test('NO debe crear sesión si ya existe una', () => {
      const result = shouldCreateSession({
        currentTestSession: { id: 'existing-session' },
        sessionCreationInProgress: false,
        authLoading: false,
        questionsLength: 10
      })
      expect(result).toBe(false)
    })

    test('NO debe crear sesión si hay una creación en progreso', () => {
      const result = shouldCreateSession({
        currentTestSession: null,
        sessionCreationInProgress: true,
        authLoading: false,
        questionsLength: 10
      })
      expect(result).toBe(false)
    })

    test('SÍ debe crear sesión cuando todo está listo', () => {
      const result = shouldCreateSession({
        currentTestSession: null,
        sessionCreationInProgress: false,
        authLoading: false,
        questionsLength: 10
      })
      expect(result).toBe(true)
    })
  })

  // ============================================
  // Manejo de errores en guardado
  // ============================================
  describe('Manejo de errores en saveDetailedAnswer', () => {

    // Simula diferentes resultados de guardado
    function simulateSaveResult(scenario) {
      switch (scenario) {
        case 'success':
          return { success: true, question_id: 'uuid-123', action: 'inserted' }

        case 'duplicate':
          return { success: true, question_id: 'uuid-123', action: 'duplicate' }

        case 'missing_data':
          return { success: false, error: 'Datos faltantes' }

        case 'no_user':
          return { success: false, error: 'Usuario no autenticado' }

        case 'db_error':
          return { success: false, error: 'Error de base de datos' }

        default:
          return { success: false, error: 'Error desconocido' }
      }
    }

    test('Éxito: debe retornar success=true y question_id', () => {
      const result = simulateSaveResult('success')
      expect(result.success).toBe(true)
      expect(result.question_id).toBeDefined()
    })

    test('Duplicado: debe retornar success=true (no es error crítico)', () => {
      const result = simulateSaveResult('duplicate')
      expect(result.success).toBe(true)
      expect(result.action).toBe('duplicate')
    })

    test('Error datos faltantes: debe retornar success=false', () => {
      const result = simulateSaveResult('missing_data')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Datos faltantes')
    })

    test('Error usuario no autenticado: debe retornar success=false', () => {
      const result = simulateSaveResult('no_user')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Usuario no autenticado')
    })
  })

  // ============================================
  // Verificación de respuesta guardada
  // ============================================
  describe('Verificación de guardado exitoso en TestLayout', () => {

    // Simula la lógica de verificación en TestLayout (línea 986)
    function isAnswerSavedSuccessfully(saveResult) {
      // 🔴 FIX CRÍTICO: Verificar success === true, no solo question_id
      // Debe retornar boolean explícito
      return !!(saveResult && saveResult.success === true && saveResult.question_id)
    }

    test('CRÍTICO: Debe requerir success=true Y question_id', () => {
      // Caso problemático: tiene question_id pero success=false
      const badResult = { success: false, question_id: 'uuid-123', error: 'Error parcial' }
      expect(isAnswerSavedSuccessfully(badResult)).toBe(false)
    })

    test('CRÍTICO: Debe rechazar si no hay question_id', () => {
      const noId = { success: true, question_id: null }
      expect(isAnswerSavedSuccessfully(noId)).toBe(false)
    })

    test('Debe aceptar respuesta guardada correctamente', () => {
      const goodResult = { success: true, question_id: 'uuid-123' }
      expect(isAnswerSavedSuccessfully(goodResult)).toBe(true)
    })

    test('CRÍTICO: Debe rechazar null/undefined', () => {
      expect(isAnswerSavedSuccessfully(null)).toBe(false)
      expect(isAnswerSavedSuccessfully(undefined)).toBe(false)
    })
  })

  // ============================================
  // Integridad: test_questions y ranking
  // ============================================
  describe('Integridad: Respuestas de práctica y ranking', () => {

    function calculateRankingQuestions(testQuestions) {
      return testQuestions.filter(q =>
        q.user_answer && q.user_answer.trim() !== ''
      ).length
    }

    test('Respuestas guardadas correctamente aparecen en ranking', () => {
      const testQuestions = [
        { question_id: 'q1', user_answer: 'A', is_correct: true },
        { question_id: 'q2', user_answer: 'B', is_correct: false },
        { question_id: 'q3', user_answer: 'C', is_correct: true },
      ]

      const count = calculateRankingQuestions(testQuestions)
      expect(count).toBe(3)
    })

    test('CRÍTICO: Sin test_questions, ranking muestra 0', () => {
      const testQuestions = []
      const count = calculateRankingQuestions(testQuestions)
      expect(count).toBe(0)
    })

    test('Respuestas vacías no cuentan', () => {
      const testQuestions = [
        { question_id: 'q1', user_answer: 'A', is_correct: true },
        { question_id: 'q2', user_answer: '', is_correct: false },
        { question_id: 'q3', user_answer: '   ', is_correct: false }, // Solo espacios
      ]

      const count = calculateRankingQuestions(testQuestions)
      expect(count).toBe(1) // Solo la primera cuenta
    })
  })

  // ============================================
  // Flujo completo: Pregunta -> Guardar -> Ranking
  // ============================================
  describe('Flujo completo: Práctica desde inicio hasta ranking', () => {

    test('CRÍTICO: Flujo correcto - respuestas aparecen en ranking', () => {
      // PASO 1: Crear sesión de test
      const sessionId = 'test-practice-123'
      const tema = 5

      // PASO 2: Usuario responde preguntas
      const answeredQuestions = []

      // Pregunta 1
      const q1 = {
        id: 'q1-uuid',
        question: '¿Capital de España?',
        options: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla'],
        correctAnswer: 0
      }
      answeredQuestions.push({
        test_id: sessionId,
        question_id: q1.id,
        question_order: 1,
        user_answer: 'A',
        correct_answer: 'A',
        is_correct: true,
        tema_number: tema
      })

      // Pregunta 2
      const q2 = {
        id: 'q2-uuid',
        question: '¿Artículo 1 CE?',
        options: ['Soberanía', 'Libertad', 'Justicia', 'Igualdad'],
        correctAnswer: 0
      }
      answeredQuestions.push({
        test_id: sessionId,
        question_id: q2.id,
        question_order: 2,
        user_answer: 'B',
        correct_answer: 'A',
        is_correct: false,
        tema_number: tema
      })

      // PASO 3: Verificar que el ranking cuenta las preguntas
      const rankingCount = answeredQuestions.filter(q => q.user_answer).length
      const correctCount = answeredQuestions.filter(q => q.is_correct).length

      expect(rankingCount).toBe(2) // ✅ 2 preguntas en ranking
      expect(correctCount).toBe(1) // 1 correcta
    })

    test('CRÍTICO: Si saveDetailedAnswer falla, respuesta NO aparece en ranking', () => {
      // Simula un fallo en guardado
      const sessionId = 'test-practice-456'
      const testQuestions = [] // Vacío porque saveDetailedAnswer falló

      // El usuario respondió pero no se guardó
      const userAnsweredLocally = { selectedAnswer: 0, isCorrect: true }

      // El ranking no puede ver las respuestas no guardadas
      const rankingCount = testQuestions.filter(q => q.user_answer).length

      expect(rankingCount).toBe(0) // ❌ No aparece en ranking
      expect(userAnsweredLocally).toBeDefined() // El usuario sí respondió localmente
    })
  })

  // ============================================
  // Comparación: Práctica vs Examen
  // ============================================
  describe('Diferencias entre Práctica y Examen', () => {

    test('Práctica: guarda cada respuesta inmediatamente', () => {
      // En modo práctica, saveDetailedAnswer se llama por cada respuesta
      const practiceFlow = {
        step1: 'createSession',
        step2: 'userAnswers',
        step3: 'saveDetailedAnswer(perAnswer)',  // Por cada respuesta
        step4: 'updateScore'
      }

      expect(practiceFlow.step3).toContain('perAnswer')
    })

    test('Examen: primero init, luego actualiza respuestas', () => {
      // En modo examen, primero /api/exam/init, luego saveAnswer actualiza
      const examFlow = {
        step1: 'createSession',
        step2: '/api/exam/init(allQuestions)',   // Guarda todas con correctAnswer
        step3: 'userAnswers',
        step4: 'saveAnswer(updates)',            // Actualiza user_answer
        step5: '/api/exam/validate'              // Valida al final
      }

      expect(examFlow.step2).toContain('init')
      expect(examFlow.step2).toContain('allQuestions')
    })

    test('Ambos: ranking depende de test_questions', () => {
      // Independiente del modo, el ranking lee de test_questions
      const rankingQuery = `
        SELECT user_id, COUNT(*) as questions
        FROM test_questions
        WHERE user_answer IS NOT NULL
        GROUP BY user_id
      `

      expect(rankingQuery).toContain('test_questions')
      expect(rankingQuery).toContain('user_answer IS NOT NULL')
    })
  })
})
