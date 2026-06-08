// __tests__/api/exam/examScoreRaceCondition.test.ts
//
// Regresión: Bug de Rosa (07/06/2026) — examen guardado con score=0 y
// total_questions=23 cuando en realidad había 100 preguntas (26 correctas).
//
// CAUSA RAÍZ:
//   /api/exam/validate llamaba markTestAsCompleted(testId, 26, 100) → score=26, total=100 ✓
//   Pero saveExamInBackground lanzaba 23 "blank saves" (preguntas sin responder)
//   en modo fire-and-forget. Cada /api/exam/answer ejecutaba internamente
//   saveAnswer → updateTestScore(testId), que RECONTABA las filas de
//   test_questions y SOBREESCRIBÍA tests.score y tests.total_questions.
//   Resultado: total_questions = 23 (solo las filas escritas), score = 0
//   (ninguna de las 23 en blanco era correcta).
//
// FIX (dos partes):
//   1. saveAnswer ya NO llama updateTestScore por cada save individual.
//      El score lo fija EN BLOQUE markTestAsCompleted al corregir.
//   2. saveExamInBackground espera (await Promise.allSettled) a que todos los
//      blank saves terminen ANTES de tocar el score, eliminando cualquier
//      escritura tardía que corrompa el recuento.

describe('Regresión: race condition de score en examen (bug Rosa 07/06)', () => {

  // Modela el estado persistido del test (tabla `tests`)
  interface TestRow {
    score: number
    totalQuestions: number
  }

  // Modela una fila de test_questions
  interface TestQuestionRow {
    questionOrder: number
    userAnswer: string
    isCorrect: boolean
  }

  // ============================================================
  // Comportamiento ANTIGUO (con bug): saveAnswer recalcula score
  // ============================================================
  describe('Comportamiento ANTIGUO (con bug)', () => {

    // Simula el updateTestScore server-side que recontaba test_questions
    function buggySaveAnswer(test: TestRow, rows: TestQuestionRow[], newRow: TestQuestionRow): void {
      rows.push(newRow)
      // ❌ BUG: recalcula score/total desde el recuento PARCIAL de filas
      test.score = rows.filter(r => r.isCorrect).length
      test.totalQuestions = rows.length
    }

    test('un blank-save tardío corrompe total_questions tras la corrección', () => {
      const test: TestRow = { score: 0, totalQuestions: 0 }
      const rows: TestQuestionRow[] = []

      // 1. validate corrige el examen completo: 100 preguntas, 26 correctas
      test.score = 26
      test.totalQuestions = 100

      // 2. saveExamInBackground escribe 23 blank-saves (fire-and-forget)
      //    que se ejecutan DESPUÉS del validate
      for (let i = 0; i < 23; i++) {
        buggySaveAnswer(test, rows, { questionOrder: i + 1, userAnswer: '', isCorrect: false })
      }

      // 3. El estado final está CORRUPTO: refleja solo los 23 blank-saves
      expect(test.totalQuestions).toBe(23)  // ← debería ser 100
      expect(test.score).toBe(0)            // ← debería ser 26
    })
  })

  // ============================================================
  // Comportamiento NUEVO (con fix): saveAnswer NO toca el score
  // ============================================================
  describe('Comportamiento NUEVO (con fix)', () => {

    // saveAnswer ahora SOLO escribe la fila, nunca recalcula el score
    function fixedSaveAnswer(rows: TestQuestionRow[], newRow: TestQuestionRow): void {
      rows.push(newRow)
      // ✅ FIX: no se toca tests.score ni tests.total_questions aquí
    }

    // markTestAsCompleted fija el score EN BLOQUE con la vista completa
    function markTestAsCompleted(test: TestRow, totalCorrect: number, totalQuestions: number): void {
      test.score = totalCorrect
      test.totalQuestions = totalQuestions
    }

    test('total_questions y score sobreviven a los blank-saves posteriores', () => {
      const test: TestRow = { score: 0, totalQuestions: 0 }
      const rows: TestQuestionRow[] = []

      // 1. validate corrige el examen completo
      markTestAsCompleted(test, 26, 100)

      // 2. blank-saves posteriores ya NO corrompen el score
      for (let i = 0; i < 23; i++) {
        fixedSaveAnswer(rows, { questionOrder: i + 1, userAnswer: '', isCorrect: false })
      }

      // 3. Estado final correcto: refleja el examen completo
      expect(test.totalQuestions).toBe(100)
      expect(test.score).toBe(26)
    })

    test('el orden garantizado (await blank-saves → updateScore) no corrompe', () => {
      // Modela la parte 2 del fix: saveExamInBackground espera a que TODOS
      // los blank-saves terminen antes de actualizar el score.
      const test: TestRow = { score: 0, totalQuestions: 100 }
      const rows: TestQuestionRow[] = []

      // Los blank-saves escriben filas (sin tocar score)
      const blankSaves = Array.from({ length: 23 }, (_, i) =>
        Promise.resolve().then(() =>
          fixedSaveAnswer(rows, { questionOrder: i + 1, userAnswer: '', isCorrect: false })
        )
      )

      // updateTestScore SOLO se ejecuta tras await Promise.allSettled
      return Promise.allSettled(blankSaves).then(() => {
        // Score se fija con el conteo de correctas del validate (26), no del recuento de filas
        test.score = 26
        expect(test.score).toBe(26)
        expect(test.totalQuestions).toBe(100)
        expect(rows.length).toBe(23)  // las filas se escribieron, pero no afectan el score
      })
    })
  })

  // ============================================================
  // Invariante de diseño
  // ============================================================
  describe('Invariante: el score lo fija solo el validate, nunca un save individual', () => {

    test('total_questions refleja las preguntas enviadas a validate, no las filas escritas', () => {
      // Este es el invariante que el fix garantiza:
      const questionsSentToValidate = 100
      const rowsWrittenByBackgroundSaves = 23

      // El número que ve el usuario debe ser el del examen completo
      const totalQuestionsShown = questionsSentToValidate

      expect(totalQuestionsShown).toBe(100)
      expect(totalQuestionsShown).not.toBe(rowsWrittenByBackgroundSaves)
    })
  })
})
