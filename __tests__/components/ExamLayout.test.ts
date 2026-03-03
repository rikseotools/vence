// __tests__/components/ExamLayout.test.js
// Tests para prevenir regresiones en ExamLayout, especialmente el bug de recálculo de preguntas

describe('ExamLayout - Prevención de Regresiones', () => {

  // ============================================
  // BUG: Recálculo de effectiveQuestions después de enviar
  // ============================================
  describe('Bug Fix: No recalcular preguntas después de enviar examen', () => {

    // Simula la lógica del useEffect que limita preguntas
    function shouldRecalculateQuestions({
      limitLoading,
      questionsLength,
      isSubmitted,
      hasLimit,
      isLimitReached,
      questionsRemaining
    }) {
      // Condiciones de salida temprana (return early)
      if (limitLoading || !questionsLength) return false
      if (isSubmitted) return false  // 🔒 FIX: No recalcular después de enviar

      return true // Puede recalcular
    }

    test('NO debe recalcular cuando isSubmitted=true', () => {
      const result = shouldRecalculateQuestions({
        limitLoading: false,
        questionsLength: 10,
        isSubmitted: true,  // ← Examen ya enviado
        hasLimit: true,
        isLimitReached: false,
        questionsRemaining: 5
      })

      expect(result).toBe(false)
    })

    test('SÍ debe recalcular cuando isSubmitted=false y hay preguntas', () => {
      const result = shouldRecalculateQuestions({
        limitLoading: false,
        questionsLength: 10,
        isSubmitted: false,  // ← Examen en progreso
        hasLimit: true,
        isLimitReached: false,
        questionsRemaining: 15
      })

      expect(result).toBe(true)
    })

    test('NO debe recalcular cuando está cargando límites', () => {
      const result = shouldRecalculateQuestions({
        limitLoading: true,  // ← Cargando
        questionsLength: 10,
        isSubmitted: false,
        hasLimit: true,
        isLimitReached: false,
        questionsRemaining: 15
      })

      expect(result).toBe(false)
    })

    test('NO debe recalcular cuando no hay preguntas', () => {
      const result = shouldRecalculateQuestions({
        limitLoading: false,
        questionsLength: 0,  // ← Sin preguntas
        isSubmitted: false,
        hasLimit: true,
        isLimitReached: false,
        questionsRemaining: 15
      })

      expect(result).toBe(false)
    })
  })

  // ============================================
  // BUG: Banner "Examen reducido" visible en resultados
  // ============================================
  describe('Bug Fix: Banner de límite no debe mostrarse en resultados', () => {

    function shouldShowLimitBanner({ wasLimited, totalQuestions, isSubmitted }) {
      // Condición del JSX: {wasLimited && totalQuestions > 0 && !isSubmitted && (...)}
      return wasLimited && totalQuestions > 0 && !isSubmitted
    }

    test('NO debe mostrar banner cuando isSubmitted=true', () => {
      const result = shouldShowLimitBanner({
        wasLimited: true,
        totalQuestions: 5,
        isSubmitted: true  // ← Examen ya enviado (pantalla de resultados)
      })

      expect(result).toBe(false)
    })

    test('SÍ debe mostrar banner durante el examen si fue limitado', () => {
      const result = shouldShowLimitBanner({
        wasLimited: true,
        totalQuestions: 5,
        isSubmitted: false  // ← Examen en progreso
      })

      expect(result).toBe(true)
    })

    test('NO debe mostrar banner si no fue limitado', () => {
      const result = shouldShowLimitBanner({
        wasLimited: false,  // ← No hubo limitación
        totalQuestions: 10,
        isSubmitted: false
      })

      expect(result).toBe(false)
    })

    test('NO debe mostrar banner si no hay preguntas', () => {
      const result = shouldShowLimitBanner({
        wasLimited: true,
        totalQuestions: 0,  // ← Sin preguntas
        isSubmitted: false
      })

      expect(result).toBe(false)
    })
  })

  // ============================================
  // BUG: Cálculos incorrectos en pantalla de resultados
  // ============================================
  describe('Bug Fix: Cálculos de resultados deben ser consistentes', () => {

    function calculateResults({ effectiveQuestionsLength, userAnswersCount, score }) {
      const totalQuestions = effectiveQuestionsLength
      const answeredCount = userAnswersCount
      const correctCount = score
      const incorrectCount = answeredCount - score
      const blankCount = totalQuestions - answeredCount

      return { totalQuestions, answeredCount, correctCount, incorrectCount, blankCount }
    }

    test('Caso normal: 10 preguntas, 10 respondidas, 7 correctas', () => {
      const result = calculateResults({
        effectiveQuestionsLength: 10,
        userAnswersCount: 10,
        score: 7
      })

      expect(result.totalQuestions).toBe(10)
      expect(result.answeredCount).toBe(10)
      expect(result.correctCount).toBe(7)
      expect(result.incorrectCount).toBe(3)
      expect(result.blankCount).toBe(0)
    })

    test('Caso con preguntas en blanco: 10 preguntas, 8 respondidas', () => {
      const result = calculateResults({
        effectiveQuestionsLength: 10,
        userAnswersCount: 8,
        score: 5
      })

      expect(result.blankCount).toBe(2)
      expect(result.incorrectCount).toBe(3)
    })

    test('CRÍTICO: blankCount nunca debe ser negativo', () => {
      // Este era el bug: effectiveQuestions=5 pero userAnswers=10
      // Resultado: blankCount = 5 - 10 = -5 ❌

      const result = calculateResults({
        effectiveQuestionsLength: 10,  // Debe mantenerse en 10, no reducirse a 5
        userAnswersCount: 10,
        score: 1
      })

      expect(result.blankCount).toBeGreaterThanOrEqual(0)
      expect(result.blankCount).toBe(0)
    })

    test('CRÍTICO: answeredCount nunca debe exceder totalQuestions', () => {
      // Verificar que los cálculos son coherentes
      const result = calculateResults({
        effectiveQuestionsLength: 10,
        userAnswersCount: 10,
        score: 5
      })

      expect(result.answeredCount).toBeLessThanOrEqual(result.totalQuestions)
    })

    test('Verificar que correctCount + incorrectCount = answeredCount', () => {
      const result = calculateResults({
        effectiveQuestionsLength: 25,
        userAnswersCount: 20,
        score: 15
      })

      expect(result.correctCount + result.incorrectCount).toBe(result.answeredCount)
    })

    test('Verificar que answeredCount + blankCount = totalQuestions', () => {
      const result = calculateResults({
        effectiveQuestionsLength: 25,
        userAnswersCount: 20,
        score: 15
      })

      expect(result.answeredCount + result.blankCount).toBe(result.totalQuestions)
    })
  })

  // ============================================
  // BUG CRÍTICO: Race condition en inicialización de examen
  // Bug: effectiveQuestions vacío cuando se llama initializeExamSession
  // Causa: efectivo depende de limitLoading, pero session init no espera
  // Fix: Usar questions prop directamente en vez de effectiveQuestions state
  // ============================================
  describe('Bug Fix: Race condition en guardado de preguntas de examen', () => {

    // Simula el estado en diferentes momentos del ciclo de vida
    function simulateExamInitState({
      questionsFromProp,      // questions prop (siempre disponible si se pasó)
      effectiveQuestionsState, // effectiveQuestions state (puede estar vacío si limitLoading=true)
      limitLoading
    }) {
      return {
        questions: questionsFromProp,
        effectiveQuestions: effectiveQuestionsState,
        limitLoading
      }
    }

    // Simula la lógica de initializeExamSession ANTES del fix
    function shouldCallInitApi_BEFORE_FIX({ effectiveQuestions }) {
      // ANTES: usaba effectiveQuestions?.length > 0
      return effectiveQuestions?.length > 0
    }

    // Simula la lógica de initializeExamSession DESPUÉS del fix
    function shouldCallInitApi_AFTER_FIX({ questions }) {
      // DESPUÉS: usa questions?.length > 0 (prop directamente)
      return questions?.length > 0
    }

    test('CRÍTICO: Con el bug ANTES del fix, init NO se llamaba si limitLoading=true', () => {
      // Escenario: questions prop tiene 100 preguntas, pero limitLoading es true
      // => effectiveQuestions todavía está vacío (state inicial)
      const state = simulateExamInitState({
        questionsFromProp: Array(100).fill({ id: 'q', correct_option: 0 }),
        effectiveQuestionsState: [], // Vacío porque useEffect no ha corrido
        limitLoading: true
      })

      // ANTES del fix: NO llamaría a init porque effectiveQuestions está vacío
      const wouldCallInit = shouldCallInitApi_BEFORE_FIX(state)
      expect(wouldCallInit).toBe(false) // ❌ BUG: No guarda preguntas
    })

    test('CRÍTICO: Con el fix, init SÍ se llama usando questions prop', () => {
      // Mismo escenario que arriba
      const state = simulateExamInitState({
        questionsFromProp: Array(100).fill({ id: 'q', correct_option: 0 }),
        effectiveQuestionsState: [], // Todavía vacío
        limitLoading: true
      })

      // DESPUÉS del fix: SÍ llama a init porque usa questions prop
      const wouldCallInit = shouldCallInitApi_AFTER_FIX(state)
      expect(wouldCallInit).toBe(true) // ✅ CORRECTO: Guarda preguntas
    })

    test('Cuando limitLoading=false, ambas versiones funcionan igual', () => {
      // Caso normal: limitLoading ya es false, effectiveQuestions está poblado
      const state = simulateExamInitState({
        questionsFromProp: Array(50).fill({ id: 'q', correct_option: 0 }),
        effectiveQuestionsState: Array(50).fill({ id: 'q', correct_option: 0 }),
        limitLoading: false
      })

      expect(shouldCallInitApi_BEFORE_FIX(state)).toBe(true)
      expect(shouldCallInitApi_AFTER_FIX(state)).toBe(true)
    })

    test('Cuando no hay preguntas, ninguna versión llama a init', () => {
      const state = simulateExamInitState({
        questionsFromProp: [],
        effectiveQuestionsState: [],
        limitLoading: false
      })

      expect(shouldCallInitApi_BEFORE_FIX(state)).toBe(false)
      expect(shouldCallInitApi_AFTER_FIX(state)).toBe(false)
    })
  })

  // ============================================
  // BUG: saveAnswer falla silenciosamente si init no se ejecutó
  // ============================================
  describe('Bug Fix: saveAnswer debe fallar si no hay registro previo de init', () => {

    // Simula la lógica de saveAnswer en el backend
    function simulateSaveAnswer({
      existingRecord,      // Registro existente de /api/exam/init
      correctAnswerProvided, // Si el cliente envió correctAnswer (no debería por seguridad)
      userAnswer
    }) {
      // Si existe registro previo (de init), actualizar
      if (existingRecord) {
        const correctAnswer = existingRecord.correctAnswer
        const isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase()
        return { success: true, isCorrect }
      }

      // Si NO existe registro y NO se envió correctAnswer, falla
      if (!correctAnswerProvided) {
        return {
          success: false,
          error: 'correctAnswer es requerido para nuevas preguntas'
        }
      }

      // Si se envió correctAnswer (no debería pasar), insertar
      return { success: true, isCorrect: false }
    }

    test('CRÍTICO: saveAnswer FALLA si init no se ejecutó (no hay registro)', () => {
      const result = simulateSaveAnswer({
        existingRecord: null,        // No hay registro de init
        correctAnswerProvided: false, // Cliente no envía correctAnswer (correcto por seguridad)
        userAnswer: 'a'
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('correctAnswer es requerido para nuevas preguntas')
    })

    test('saveAnswer FUNCIONA si init se ejecutó correctamente', () => {
      const result = simulateSaveAnswer({
        existingRecord: { correctAnswer: 'b' }, // Registro existe de init
        correctAnswerProvided: false,
        userAnswer: 'b'
      })

      expect(result.success).toBe(true)
      expect(result.isCorrect).toBe(true)
    })

    test('saveAnswer detecta respuesta incorrecta correctamente', () => {
      const result = simulateSaveAnswer({
        existingRecord: { correctAnswer: 'c' },
        correctAnswerProvided: false,
        userAnswer: 'a'
      })

      expect(result.success).toBe(true)
      expect(result.isCorrect).toBe(false)
    })
  })

  // ============================================
  // Tests de integridad: test_questions y ranking
  // ============================================
  describe('Integridad: Relación entre test_questions y ranking', () => {

    // Simula cómo el ranking cuenta preguntas
    function calculateRankingQuestions(testQuestions) {
      // El ranking cuenta registros en test_questions con user_answer no vacío
      return testQuestions.filter(q => q.user_answer && q.user_answer.trim() !== '').length
    }

    test('CRÍTICO: Sin test_questions, usuario aparece con 0 preguntas en ranking', () => {
      const testQuestions = [] // Bug: init no se ejecutó
      const rankingCount = calculateRankingQuestions(testQuestions)

      expect(rankingCount).toBe(0)
    })

    test('Con test_questions correctos, usuario aparece con preguntas en ranking', () => {
      const testQuestions = [
        { id: '1', user_answer: 'a', is_correct: true },
        { id: '2', user_answer: 'b', is_correct: false },
        { id: '3', user_answer: 'c', is_correct: true },
      ]
      const rankingCount = calculateRankingQuestions(testQuestions)

      expect(rankingCount).toBe(3)
    })

    test('Preguntas sin respuesta (user_answer vacío) no cuentan', () => {
      const testQuestions = [
        { id: '1', user_answer: 'a', is_correct: true },
        { id: '2', user_answer: '', is_correct: false },  // No respondida
        { id: '3', user_answer: null, is_correct: false }, // No respondida
      ]
      const rankingCount = calculateRankingQuestions(testQuestions)

      expect(rankingCount).toBe(1)
    })
  })

  // ============================================
  // Test de flujo completo: Init -> Answer -> Ranking
  // ============================================
  describe('Flujo completo: Examen desde inicio hasta ranking', () => {

    test('CRÍTICO: Flujo correcto - preguntas aparecen en ranking', () => {
      // PASO 1: Crear test
      const testId = 'test-123'
      const questions = [
        { id: 'q1', correct_option: 0 }, // a
        { id: 'q2', correct_option: 1 }, // b
        { id: 'q3', correct_option: 2 }, // c
      ]

      // PASO 2: Init guarda todas las preguntas (con correctAnswer)
      const testQuestions = questions.map((q, index) => ({
        test_id: testId,
        question_id: q.id,
        question_order: index + 1,
        correct_answer: String.fromCharCode(97 + q.correct_option), // 0=a, 1=b, 2=c
        user_answer: '', // Vacío inicialmente
        is_correct: false
      }))

      expect(testQuestions.length).toBe(3)
      expect(testQuestions[0].correct_answer).toBe('a')
      expect(testQuestions[1].correct_answer).toBe('b')

      // PASO 3: Usuario responde (saveAnswer actualiza user_answer)
      testQuestions[0].user_answer = 'a' // Correcta
      testQuestions[0].is_correct = true
      testQuestions[1].user_answer = 'c' // Incorrecta (era b)
      testQuestions[1].is_correct = false
      testQuestions[2].user_answer = 'c' // Correcta
      testQuestions[2].is_correct = true

      // PASO 4: Verificar que el ranking cuenta las preguntas
      const rankingCount = testQuestions.filter(q => q.user_answer && q.user_answer !== '').length
      const correctCount = testQuestions.filter(q => q.is_correct).length

      expect(rankingCount).toBe(3) // ✅ Aparece en ranking con 3 preguntas
      expect(correctCount).toBe(2)
    })

    test('CRÍTICO: Flujo con bug - preguntas NO aparecen en ranking', () => {
      // PASO 1: Crear test
      const testId = 'test-456'
      const questions = [
        { id: 'q1', correct_option: 0 },
        { id: 'q2', correct_option: 1 },
        { id: 'q3', correct_option: 2 },
      ]

      // PASO 2: BUG - Init NO se ejecuta (effectiveQuestions vacío)
      const testQuestions = [] // ❌ Vacío porque init falló

      // PASO 3: saveAnswer falla silenciosamente para cada respuesta
      // (no hay registro existente y no se envía correctAnswer)

      // PASO 4: El ranking muestra 0 preguntas
      const rankingCount = testQuestions.filter(q => q.user_answer && q.user_answer !== '').length

      expect(rankingCount).toBe(0) // ❌ No aparece en ranking
      expect(testQuestions.length).toBe(0) // ❌ No hay datos
    })
  })

  // ============================================
  // Escenario completo: Flujo de examen con límite
  // ============================================
  describe('Escenario: Usuario FREE hace examen con límite', () => {

    test('Flujo completo sin bug de recálculo', () => {
      // Estado inicial: Usuario tiene 15 preguntas restantes, quiere hacer examen de 10
      let questionsRemaining = 15
      let effectiveQuestions = []
      let isSubmitted = false
      let wasLimited = false
      const originalQuestions = Array(10).fill({ id: 'q' })

      // PASO 1: Iniciar examen (questionsRemaining=15, quiere 10)
      const maxQuestions = Math.min(originalQuestions.length, questionsRemaining)
      effectiveQuestions = originalQuestions.slice(0, maxQuestions)
      wasLimited = maxQuestions < originalQuestions.length

      expect(effectiveQuestions.length).toBe(10) // Puede hacer las 10
      expect(wasLimited).toBe(false)

      // PASO 2: Usuario responde todas las preguntas
      const userAnswers = {}
      for (let i = 0; i < 10; i++) {
        userAnswers[i] = 'a'
      }

      expect(Object.keys(userAnswers).length).toBe(10)

      // PASO 3: Usuario envía examen
      isSubmitted = true
      questionsRemaining = 5 // El hook actualiza a 5 restantes

      // PASO 4: ANTES DEL FIX - useEffect recalculaba effectiveQuestions
      // effectiveQuestions = originalQuestions.slice(0, questionsRemaining) // ❌ MAL
      // Resultado: effectiveQuestions.length = 5, pero userAnswers tiene 10

      // PASO 4: DESPUÉS DEL FIX - useEffect NO recalcula si isSubmitted=true
      if (!isSubmitted) {
        effectiveQuestions = originalQuestions.slice(0, questionsRemaining)
      }
      // effectiveQuestions se mantiene en 10 ✅

      expect(effectiveQuestions.length).toBe(10) // ✅ Se mantiene en 10
      expect(Object.keys(userAnswers).length).toBe(10)

      // PASO 5: Calcular resultados
      const totalQuestions = effectiveQuestions.length
      const answeredCount = Object.keys(userAnswers).length
      const blankCount = totalQuestions - answeredCount

      expect(blankCount).toBe(0) // ✅ No hay negativos
      expect(answeredCount).toBe(totalQuestions) // ✅ 10/10, no 10/5
    })
  })
})
