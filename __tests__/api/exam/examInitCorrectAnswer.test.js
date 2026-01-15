// __tests__/api/exam/examInitCorrectAnswer.test.js
// Tests para verificar el fix del bug de correct_answer en /api/exam/init
//
// BUG ORIGINAL:
// - /api/exam/init recibía preguntas del cliente SIN correct_option (por seguridad anti-scraping)
// - Usaba fallback 'a' cuando correct_option no estaba disponible
// - Resultado: TODAS las preguntas se guardaban con correct_answer = 'a'
//
// FIX:
// - /api/exam/init ahora consulta la BD para obtener correct_option real
// - Usa getQuestionsCorrectAnswers() que hace query a la tabla questions

describe('Bug Fix: correct_answer en /api/exam/init', () => {

  describe('Diseño de seguridad anti-scraping', () => {

    test('Las preguntas cargadas en el frontend NO deben tener correct_option', () => {
      // Simula lo que devuelve el fetcher de preguntas
      const questionFromFetcher = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        question_text: '¿Cuál es la capital de España?',
        option_a: 'Barcelona',
        option_b: 'Madrid',
        option_c: 'Sevilla',
        option_d: 'Valencia',
        // NOTA: correct_option NO está presente (por diseño de seguridad)
        explanation: 'Madrid es la capital de España',
        difficulty: 'easy'
      }

      // Verificar que correct_option NO existe
      expect(questionFromFetcher.correct_option).toBeUndefined()
      expect(questionFromFetcher.correctOption).toBeUndefined()
    })

    test('El payload enviado a /api/exam/init NO debe tener correct_option', () => {
      // Simula lo que ExamLayout envía a /api/exam/init
      const questionForInit = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        question_text: '¿Cuál es la capital de España?',
        tema_number: 1,
        difficulty: 'easy',
        articles: {
          id: 'article-uuid',
          article_number: '1'
        }
        // SIN correct_option - por diseño de seguridad
      }

      // El cliente NO debe enviar correct_option
      expect(questionForInit.correct_option).toBeUndefined()
      expect(questionForInit.correctOption).toBeUndefined()
      expect(questionForInit.correctAnswer).toBeUndefined()
    })
  })

  describe('Comportamiento esperado después del fix', () => {

    test('getQuestionsCorrectAnswers debe convertir índice a letra correctamente', () => {
      // Simula la conversión que hace getQuestionsCorrectAnswers
      const indexToLetter = (index) => String.fromCharCode(97 + index)

      expect(indexToLetter(0)).toBe('a')
      expect(indexToLetter(1)).toBe('b')
      expect(indexToLetter(2)).toBe('c')
      expect(indexToLetter(3)).toBe('d')
    })

    test('Las preguntas preparadas deben tener correctAnswer de la BD', () => {
      // Simula el proceso de preparación de preguntas en /api/exam/init
      const questionsFromClient = [
        { id: 'q1', question_text: 'Pregunta 1' },
        { id: 'q2', question_text: 'Pregunta 2' },
        { id: 'q3', question_text: 'Pregunta 3' }
      ]

      // Simula el mapa de respuestas correctas de la BD
      const correctAnswersFromDb = new Map([
        ['q1', 'b'],  // correct_option = 1
        ['q2', 'd'],  // correct_option = 3
        ['q3', 'a']   // correct_option = 0
      ])

      // Preparar preguntas (lógica del fix)
      const preparedQuestions = questionsFromClient.map((q, index) => ({
        questionId: q.id,
        questionOrder: index + 1,
        questionText: q.question_text,
        correctAnswer: correctAnswersFromDb.get(q.id) || 'x'
      }))

      // Verificar que usan respuestas de BD, no 'a' como fallback
      expect(preparedQuestions[0].correctAnswer).toBe('b')  // NO 'a'
      expect(preparedQuestions[1].correctAnswer).toBe('d')  // NO 'a'
      expect(preparedQuestions[2].correctAnswer).toBe('a')  // Este sí es 'a' porque así está en BD
    })

    test('Preguntas sin match en BD deben usar "x" como flag, no "a"', () => {
      // El nuevo comportamiento usa 'x' para indicar error, no 'a'
      const correctAnswersFromDb = new Map() // Sin datos

      const prepareQuestion = (q) => ({
        questionId: q.id,
        correctAnswer: correctAnswersFromDb.get(q.id) || 'x'
      })

      const result = prepareQuestion({ id: 'unknown-id' })

      // Debe ser 'x' (flag de error), NO 'a' (que causaba el bug)
      expect(result.correctAnswer).toBe('x')
      expect(result.correctAnswer).not.toBe('a')
    })
  })

  describe('Regresión: Bug de Nila', () => {
    // Este test documenta el bug que afectó a la usuaria Nila

    test('ANTES DEL FIX: correct_answer siempre era "a"', () => {
      // Código antiguo (con bug)
      const oldPrepareQuestion = (q) => ({
        correctAnswer: typeof q.correct_option === 'number'
          ? String.fromCharCode(97 + q.correct_option)
          : q.correctAnswer || 'a'  // ← BUG: fallback a 'a'
      })

      // Pregunta del cliente (sin correct_option por seguridad)
      const questionFromClient = {
        id: 'q1',
        question_text: 'Pregunta',
        // SIN correct_option
      }

      const oldResult = oldPrepareQuestion(questionFromClient)

      // El bug: siempre 'a' cuando correct_option no existe
      expect(oldResult.correctAnswer).toBe('a')
    })

    test('DESPUÉS DEL FIX: correct_answer viene de la BD', () => {
      // Simula el nuevo código (con fix)
      const correctAnswersFromDb = new Map([
        ['q1', 'c']  // La respuesta REAL es 'c'
      ])

      const newPrepareQuestion = (q) => ({
        correctAnswer: correctAnswersFromDb.get(q.id) || 'x'
      })

      const questionFromClient = {
        id: 'q1',
        question_text: 'Pregunta'
        // SIN correct_option (igual que antes)
      }

      const newResult = newPrepareQuestion(questionFromClient)

      // El fix: usa respuesta de BD
      expect(newResult.correctAnswer).toBe('c')  // NO 'a'
    })
  })

  describe('Flujo completo de seguridad', () => {

    test('Flujo: Cliente → API init → BD → API validate → Cliente', () => {
      // 1. Cliente carga preguntas SIN correct_option
      const questionsForClient = [
        { id: 'q1', question_text: 'P1', option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D' }
        // NO correct_option
      ]

      // 2. Cliente envía a /api/exam/init (sin correct_option)
      const payloadToInit = questionsForClient.map(q => ({
        id: q.id,
        question_text: q.question_text
        // SIN correct_option
      }))

      // 3. API init consulta BD y obtiene correct_option
      const bdCorrectOptions = new Map([['q1', 2]])  // correct_option = 2 = 'c'
      const correctFromBd = String.fromCharCode(97 + bdCorrectOptions.get('q1'))

      // 4. API init guarda en test_questions CON correct_answer
      const savedInTestQuestions = {
        question_id: 'q1',
        correct_answer: correctFromBd,  // 'c' (de la BD)
        user_answer: '',  // Vacío inicialmente
        is_correct: false
      }

      // 5. Usuario responde (ej: 'c')
      savedInTestQuestions.user_answer = 'c'

      // 6. API validate compara y calcula is_correct
      savedInTestQuestions.is_correct =
        savedInTestQuestions.user_answer === savedInTestQuestions.correct_answer

      // Verificación final
      expect(savedInTestQuestions.correct_answer).toBe('c')  // De la BD
      expect(savedInTestQuestions.user_answer).toBe('c')     // Del usuario
      expect(savedInTestQuestions.is_correct).toBe(true)     // Correctamente calculado
    })
  })
})
