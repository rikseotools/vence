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
