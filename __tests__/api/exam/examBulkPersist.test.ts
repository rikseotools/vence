// __tests__/api/exam/examBulkPersist.test.ts
//
// Contrato de la persistencia en bloque de /api/exam/validate (persistExamQuestions).
//
// Tras el bug del 08/06 (30/40 exámenes con test_questions incompleto o vacío
// porque los ~50 saves fire-and-forget durante el examen fallaban bajo carga),
// validate pasa a ser la fuente ÚNICA y fiable: recibe TODAS las respuestas de
// golpe y escribe una fila por pregunta válida en un solo UPSERT.
//
// Este test bloquea las invariantes del mapeo result→row para que no regresen.

describe('Contrato: persistencia en bloque de test_questions (validate)', () => {

  // Réplica de la lógica de construcción de filas en persistExamQuestions.
  // Si cambia el route, este modelo debe cambiar con él (test de contrato).
  interface ValidatedResult {
    questionId: string
    userAnswer: string | null
    correctAnswer: string
    correctIndex: number
    isCorrect: boolean
  }
  interface ClientAnswer {
    questionOrder?: number
    questionText?: string
    articleId?: string | null
    articleNumber?: string | null
    lawName?: string | null
    temaNumber?: number | null
    difficulty?: string | null
  }
  interface QuestionMeta {
    questionText: string
    difficulty: string | null
    primaryArticleId: string | null
  }

  function buildRows(
    testId: string,
    userId: string | null,
    answers: ClientAnswer[],
    results: ValidatedResult[],
    metaMap: Map<string, QuestionMeta>
  ) {
    return results
      .map((r, i) => {
        if (r.correctIndex < 0) return null
        const meta = metaMap.get(r.questionId)
        if (!meta) return null
        const clientAnswer = answers[i]
        const answered = r.userAnswer != null && r.userAnswer !== ''
        return {
          testId,
          userId,
          questionId: r.questionId,
          articleId: clientAnswer?.articleId ?? meta.primaryArticleId ?? null,
          questionOrder: clientAnswer?.questionOrder ?? i + 1,
          questionText: clientAnswer?.questionText || meta.questionText || '',
          userAnswer: r.userAnswer ?? '',
          correctAnswer: r.correctAnswer,
          isCorrect: r.isCorrect,
          articleNumber: clientAnswer?.articleNumber ?? null,
          lawName: clientAnswer?.lawName ?? null,
          temaNumber: clientAnswer?.temaNumber ?? null,
          difficulty: clientAnswer?.difficulty ?? meta.difficulty ?? null,
          wasBlank: !answered,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
  }

  const meta = (text: string): QuestionMeta => ({
    questionText: text,
    difficulty: 'medium',
    primaryArticleId: 'art-1',
  })

  it('escribe una fila por pregunta válida (respondidas + blancas)', () => {
    // El caso Rosa: 100 preguntas, 77 respondidas + 23 en blanco → 100 filas.
    const results: ValidatedResult[] = Array.from({ length: 100 }, (_, i) => ({
      questionId: `q${i}`,
      userAnswer: i < 77 ? 'a' : null, // 77 respondidas, 23 blancas
      correctAnswer: 'a',
      correctIndex: 0,
      isCorrect: i < 77,
    }))
    const metaMap = new Map(results.map(r => [r.questionId, meta('texto')]))
    const rows = buildRows('test-1', 'user-1', [], results, metaMap)

    // INVARIANTE CLAVE: 100 filas, no 23 (antes solo se guardaban las blancas)
    expect(rows.length).toBe(100)
    expect(rows.filter(r => !r.wasBlank).length).toBe(77)
    expect(rows.filter(r => r.wasBlank).length).toBe(23)
  })

  it('marca wasBlank y userAnswer correctamente', () => {
    const results: ValidatedResult[] = [
      { questionId: 'q0', userAnswer: 'b', correctAnswer: 'b', correctIndex: 1, isCorrect: true },
      { questionId: 'q1', userAnswer: null, correctAnswer: 'c', correctIndex: 2, isCorrect: false },
    ]
    const metaMap = new Map(results.map(r => [r.questionId, meta('t')]))
    const rows = buildRows('test-1', 'user-1', [], results, metaMap)

    expect(rows[0]).toMatchObject({ userAnswer: 'b', wasBlank: false, isCorrect: true })
    expect(rows[1]).toMatchObject({ userAnswer: '', wasBlank: true, isCorrect: false })
  })

  it('omite preguntas no encontradas en BD (correctIndex -1)', () => {
    const results: ValidatedResult[] = [
      { questionId: 'q0', userAnswer: 'a', correctAnswer: 'a', correctIndex: 0, isCorrect: true },
      { questionId: 'retirada', userAnswer: 'a', correctAnswer: '?', correctIndex: -1, isCorrect: false },
    ]
    const metaMap = new Map([['q0', meta('t')]]) // 'retirada' no está
    const rows = buildRows('test-1', 'user-1', [], results, metaMap)

    expect(rows.length).toBe(1)
    expect(rows[0].questionId).toBe('q0')
  })

  it('usa enriquecimiento del cliente y cae al servidor si falta', () => {
    const results: ValidatedResult[] = [
      { questionId: 'q0', userAnswer: 'a', correctAnswer: 'a', correctIndex: 0, isCorrect: true },
      { questionId: 'q1', userAnswer: 'a', correctAnswer: 'a', correctIndex: 0, isCorrect: true },
    ]
    const metaMap = new Map([
      ['q0', { questionText: 'texto-BD', difficulty: 'hard', primaryArticleId: 'art-BD' }],
      ['q1', meta('texto-BD-2')],
    ])
    const answers: ClientAnswer[] = [
      // q0: cliente provee todo
      { questionOrder: 5, questionText: 'texto-cliente', articleNumber: '99', lawName: 'CE', temaNumber: 3, difficulty: 'easy', articleId: 'art-cliente' },
      // q1: cliente NO provee nada → fallback a BD
      {},
    ]
    const rows = buildRows('test-1', 'user-1', answers, results, metaMap)

    // q0 usa datos del cliente
    expect(rows[0]).toMatchObject({
      questionOrder: 5,
      questionText: 'texto-cliente',
      articleNumber: '99',
      lawName: 'CE',
      temaNumber: 3,
      difficulty: 'easy',
      articleId: 'art-cliente',
    })
    // q1 cae a BD: order=index+1, texto y difficulty de meta, articleId=primaryArticleId
    expect(rows[1]).toMatchObject({
      questionOrder: 2,
      questionText: 'texto-BD-2',
      difficulty: 'medium',
      articleId: 'art-1',
      articleNumber: null,
      lawName: null,
      temaNumber: null,
    })
  })

  it('el conteo de filas es independiente de los saves durante el examen', () => {
    // Refuerza el invariante: aunque 0 saves hubieran funcionado en tiempo real,
    // validate reconstruye las 50 filas desde las respuestas en memoria.
    const results: ValidatedResult[] = Array.from({ length: 50 }, (_, i) => ({
      questionId: `q${i}`,
      userAnswer: 'a',
      correctAnswer: 'a',
      correctIndex: 0,
      isCorrect: true,
    }))
    const metaMap = new Map(results.map(r => [r.questionId, meta('t')]))
    const rows = buildRows('test-1', 'user-1', [], results, metaMap)
    expect(rows.length).toBe(50)
  })
})
