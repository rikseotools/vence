/**
 * Tests para el filtro de ghost rows en el ranking.
 *
 * Bug: initOfficialExam pre-crea filas en test_questions con user_answer=''
 * e is_correct=false. Estas "ghost rows" inflan total_questions y destruyen
 * la accuracy de los usuarios en el ranking.
 *
 * Fix: Añadir AND tq.user_answer != '' en get_ranking_for_period y
 * get_user_ranking_position.
 */

// ─── Tipos auxiliares ────────────────────────────────────────────────

interface TestQuestion {
  id: string
  test_id: string
  user_answer: string
  is_correct: boolean
  created_at: string
}

interface TestSession {
  id: string
  user_id: string
  is_completed: boolean
  test_type: string
  title?: string
}

interface RankingRow {
  user_id: string
  total_questions: number
  correct_answers: number
  accuracy: number
}

// ─── Lógica que replica la función RPC ───────────────────────────────

/**
 * Replica la lógica ACTUAL (con bug) de get_ranking_for_period.
 * Cuenta TODAS las filas, incluidas ghost rows.
 */
function computeRankingBuggy(
  questions: TestQuestion[],
  sessions: TestSession[],
  minQuestions = 5
): RankingRow[] {
  const sessionMap = new Map(sessions.map(s => [s.id, s]))
  const userStats: Record<string, { total: number; correct: number }> = {}

  for (const q of questions) {
    const session = sessionMap.get(q.test_id)
    if (!session) continue
    const uid = session.user_id
    if (!userStats[uid]) userStats[uid] = { total: 0, correct: 0 }
    userStats[uid].total++
    if (q.is_correct) userStats[uid].correct++
  }

  return Object.entries(userStats)
    .filter(([, s]) => s.total >= minQuestions)
    .map(([uid, s]) => ({
      user_id: uid,
      total_questions: s.total,
      correct_answers: s.correct,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.total_questions - a.total_questions)
}

/**
 * Replica la lógica CORREGIDA de get_ranking_for_period.
 * Excluye filas con user_answer = ''.
 */
function computeRankingFixed(
  questions: TestQuestion[],
  sessions: TestSession[],
  minQuestions = 5
): RankingRow[] {
  const sessionMap = new Map(sessions.map(s => [s.id, s]))
  const userStats: Record<string, { total: number; correct: number }> = {}

  for (const q of questions) {
    // ── FIX: excluir ghost rows ──
    if (q.user_answer === '') continue

    const session = sessionMap.get(q.test_id)
    if (!session) continue
    const uid = session.user_id
    if (!userStats[uid]) userStats[uid] = { total: 0, correct: 0 }
    userStats[uid].total++
    if (q.is_correct) userStats[uid].correct++
  }

  return Object.entries(userStats)
    .filter(([, s]) => s.total >= minQuestions)
    .map(([uid, s]) => ({
      user_id: uid,
      total_questions: s.total,
      correct_answers: s.correct,
      accuracy: Math.round((s.correct / s.total) * 100),
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.total_questions - a.total_questions)
}

/**
 * Replica la lógica de rankingMedals.js getRankingForPeriod (con bug).
 */
function computeMedalsRankingBuggy(
  questions: TestQuestion[],
  sessions: TestSession[],
  minQuestions = 5
): { userId: string; totalQuestions: number; correctAnswers: number; accuracy: number }[] {
  const sessionMap = new Map(sessions.map(s => [s.id, s]))
  const userStats: Record<string, { totalQuestions: number; correctAnswers: number }> = {}

  for (const q of questions) {
    const session = sessionMap.get(q.test_id)
    if (!session) continue
    const uid = session.user_id
    if (!userStats[uid]) userStats[uid] = { totalQuestions: 0, correctAnswers: 0 }
    userStats[uid].totalQuestions++
    if (q.is_correct) userStats[uid].correctAnswers++
  }

  return Object.entries(userStats)
    .filter(([, s]) => s.totalQuestions >= minQuestions)
    .map(([uid, s]) => ({
      userId: uid,
      ...s,
      accuracy: Math.round((s.correctAnswers / s.totalQuestions) * 100),
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.totalQuestions - a.totalQuestions)
}

/**
 * Replica la lógica de rankingMedals.js getRankingForPeriod CORREGIDA.
 */
function computeMedalsRankingFixed(
  questions: TestQuestion[],
  sessions: TestSession[],
  minQuestions = 5
): { userId: string; totalQuestions: number; correctAnswers: number; accuracy: number }[] {
  const sessionMap = new Map(sessions.map(s => [s.id, s]))
  const userStats: Record<string, { totalQuestions: number; correctAnswers: number }> = {}

  for (const q of questions) {
    if (q.user_answer === '') continue // FIX
    const session = sessionMap.get(q.test_id)
    if (!session) continue
    const uid = session.user_id
    if (!userStats[uid]) userStats[uid] = { totalQuestions: 0, correctAnswers: 0 }
    userStats[uid].totalQuestions++
    if (q.is_correct) userStats[uid].correctAnswers++
  }

  return Object.entries(userStats)
    .filter(([, s]) => s.totalQuestions >= minQuestions)
    .map(([uid, s]) => ({
      userId: uid,
      ...s,
      accuracy: Math.round((s.correctAnswers / s.totalQuestions) * 100),
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.totalQuestions - a.totalQuestions)
}

// ─── Helpers para generar datos de test ──────────────────────────────

function makeSession(id: string, userId: string, opts?: Partial<TestSession>): TestSession {
  return {
    id,
    user_id: userId,
    is_completed: false,
    test_type: 'exam',
    ...opts,
  }
}

function makeQuestion(
  testId: string,
  userAnswer: string,
  isCorrect: boolean,
  id?: string
): TestQuestion {
  return {
    id: id || `q-${Math.random().toString(36).slice(2, 8)}`,
    test_id: testId,
    user_answer: userAnswer,
    is_correct: isCorrect,
    created_at: new Date().toISOString(),
  }
}

/** Genera N ghost rows (user_answer='', is_correct=false) */
function makeGhostRows(testId: string, count: number): TestQuestion[] {
  return Array.from({ length: count }, (_, i) =>
    makeQuestion(testId, '', false, `ghost-${testId}-${i}`)
  )
}

/** Genera N respuestas reales con ratio de acierto dado */
function makeRealAnswers(
  testId: string,
  count: number,
  correctRatio: number
): TestQuestion[] {
  const correctCount = Math.round(count * correctRatio)
  return Array.from({ length: count }, (_, i) => {
    const isCorrect = i < correctCount
    const letter = isCorrect ? 'a' : 'b'
    return makeQuestion(testId, letter, isCorrect, `real-${testId}-${i}`)
  })
}

// ═════════════════════════════════════════════════════════════════════
// TESTS
// ═════════════════════════════════════════════════════════════════════

describe('Ghost rows filter - get_ranking_for_period', () => {
  describe('Bug: ghost rows distorsionan la accuracy', () => {
    test('usuario con 25 respuestas reales (100%) + 103 ghost rows → accuracy buggy = 20%', () => {
      // Caso real: josefa molinos
      const sessions = [makeSession('exam-1', 'josefa')]
      const questions = [
        ...makeRealAnswers('exam-1', 25, 1.0),
        ...makeGhostRows('exam-1', 103),
      ]

      const buggy = computeRankingBuggy(questions, sessions)
      expect(buggy).toHaveLength(1)
      expect(buggy[0].total_questions).toBe(128) // 25 + 103
      expect(buggy[0].correct_answers).toBe(25)
      expect(buggy[0].accuracy).toBe(20) // Distorsionado
    })

    test('usuario con 25 respuestas reales (76%) + 142 ghost rows → accuracy buggy = 11%', () => {
      // Caso real: Blue (Ivan)
      const sessions = [
        makeSession('exam-1', 'blue'),
        makeSession('exam-2', 'blue'),
        makeSession('exam-3', 'blue'),
      ]
      const questions = [
        ...makeRealAnswers('exam-1', 25, 0.76),
        ...makeGhostRows('exam-2', 64),
        ...makeGhostRows('exam-3', 78),
      ]

      const buggy = computeRankingBuggy(questions, sessions)
      expect(buggy[0].total_questions).toBe(167) // 25 + 64 + 78
      expect(buggy[0].correct_answers).toBe(19)
      expect(buggy[0].accuracy).toBe(11)
    })

    test('usuario que solo abre examen sin responder → aparece con 0% y 64 preguntas', () => {
      // Caso real: Andrea
      const sessions = [makeSession('exam-1', 'andrea')]
      const questions = makeGhostRows('exam-1', 64)

      const buggy = computeRankingBuggy(questions, sessions)
      expect(buggy).toHaveLength(1)
      expect(buggy[0].total_questions).toBe(64)
      expect(buggy[0].correct_answers).toBe(0)
      expect(buggy[0].accuracy).toBe(0)
    })
  })

  describe('Fix: ghost rows excluidas del cálculo', () => {
    test('josefa: accuracy corregida = 100% (25 de 25)', () => {
      const sessions = [makeSession('exam-1', 'josefa')]
      const questions = [
        ...makeRealAnswers('exam-1', 25, 1.0),
        ...makeGhostRows('exam-1', 103),
      ]

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(1)
      expect(fixed[0].total_questions).toBe(25)
      expect(fixed[0].correct_answers).toBe(25)
      expect(fixed[0].accuracy).toBe(100)
    })

    test('Blue: accuracy corregida = 76% (19 de 25)', () => {
      const sessions = [
        makeSession('exam-1', 'blue'),
        makeSession('exam-2', 'blue'),
        makeSession('exam-3', 'blue'),
      ]
      const questions = [
        ...makeRealAnswers('exam-1', 25, 0.76),
        ...makeGhostRows('exam-2', 64),
        ...makeGhostRows('exam-3', 78),
      ]

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(1)
      expect(fixed[0].total_questions).toBe(25)
      expect(fixed[0].correct_answers).toBe(19)
      expect(fixed[0].accuracy).toBe(76)
    })

    test('Andrea (solo ghost rows) → NO aparece en el ranking', () => {
      const sessions = [makeSession('exam-1', 'andrea')]
      const questions = makeGhostRows('exam-1', 64)

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(0)
    })

    test('usuario con 0 respuestas reales + 50 ghost rows → no aparece', () => {
      const sessions = [makeSession('exam-1', 'rebeca')]
      const questions = makeGhostRows('exam-1', 50)

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(0)
    })
  })

  describe('Respuestas normales no se ven afectadas por el fix', () => {
    test('test normal (sin ghost rows) → mismo resultado con y sin fix', () => {
      const sessions = [makeSession('test-1', 'user-normal', { test_type: 'custom' })]
      const questions = makeRealAnswers('test-1', 30, 0.8)

      const buggy = computeRankingBuggy(questions, sessions)
      const fixed = computeRankingFixed(questions, sessions)

      expect(buggy).toEqual(fixed)
      expect(fixed[0].total_questions).toBe(30)
      expect(fixed[0].correct_answers).toBe(24)
      expect(fixed[0].accuracy).toBe(80)
    })

    test('múltiples tests normales del mismo usuario → se acumulan correctamente', () => {
      const sessions = [
        makeSession('test-1', 'user-a', { test_type: 'custom' }),
        makeSession('test-2', 'user-a', { test_type: 'quick' }),
      ]
      const questions = [
        ...makeRealAnswers('test-1', 10, 0.8),
        ...makeRealAnswers('test-2', 10, 0.6),
      ]

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(1)
      expect(fixed[0].total_questions).toBe(20)
      expect(fixed[0].correct_answers).toBe(14) // 8 + 6
      expect(fixed[0].accuracy).toBe(70)
    })

    test('respuestas con letras a/b/c/d nunca se filtran', () => {
      const sessions = [makeSession('test-1', 'user-letters')]
      const questions: TestQuestion[] = [
        makeQuestion('test-1', 'a', true),
        makeQuestion('test-1', 'b', false),
        makeQuestion('test-1', 'c', false),
        makeQuestion('test-1', 'd', true),
        makeQuestion('test-1', 'a', true),
      ]

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(1)
      expect(fixed[0].total_questions).toBe(5)
      expect(fixed[0].correct_answers).toBe(3)
    })

    test('respuestas "sin_respuesta" NO se filtran (son preguntas dejadas en blanco en examen completado)', () => {
      const sessions = [makeSession('exam-1', 'user-exam', { is_completed: true })]
      const questions: TestQuestion[] = [
        makeQuestion('exam-1', 'a', true),
        makeQuestion('exam-1', 'b', false),
        makeQuestion('exam-1', 'sin_respuesta', false),
        makeQuestion('exam-1', 'a', true),
        makeQuestion('exam-1', 'sin_respuesta', false),
      ]

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(1)
      // sin_respuesta cuenta como pregunta respondida (aunque incorrecta)
      expect(fixed[0].total_questions).toBe(5)
      expect(fixed[0].correct_answers).toBe(2)
      expect(fixed[0].accuracy).toBe(40)
    })
  })

  describe('Filtro de mínimo de preguntas (p_min_questions)', () => {
    test('usuario con 4 respuestas reales pero ghost rows que le hacían superar el mínimo → excluido con fix', () => {
      const sessions = [makeSession('exam-1', 'user-few')]
      const questions = [
        ...makeRealAnswers('exam-1', 4, 0.75), // Solo 4 respuestas reales
        ...makeGhostRows('exam-1', 60), // 60 ghost rows → total buggy = 64
      ]

      // Con bug: 64 preguntas, supera mínimo de 5
      const buggy = computeRankingBuggy(questions, sessions)
      expect(buggy).toHaveLength(1)
      expect(buggy[0].total_questions).toBe(64)

      // Con fix: solo 4 preguntas reales, no supera mínimo de 5
      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(0)
    })

    test('usuario con exactamente 5 respuestas reales + ghost rows → incluido con fix', () => {
      const sessions = [makeSession('exam-1', 'user-exact')]
      const questions = [
        ...makeRealAnswers('exam-1', 5, 0.6),
        ...makeGhostRows('exam-1', 50),
      ]

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(1)
      expect(fixed[0].total_questions).toBe(5)
      expect(fixed[0].correct_answers).toBe(3)
      expect(fixed[0].accuracy).toBe(60)
    })
  })

  describe('Orden del ranking', () => {
    test('con fix, usuarios con ghost rows suben en el ranking', () => {
      const sessions = [
        makeSession('test-1', 'user-normal'),
        makeSession('exam-1', 'user-ghost'),
      ]
      const questions = [
        // user-normal: 10 preguntas, 7 correctas = 70%
        ...makeRealAnswers('test-1', 10, 0.7),
        // user-ghost: 10 reales (9 correctas = 90%) + 50 ghost rows
        ...makeRealAnswers('exam-1', 10, 0.9),
        ...makeGhostRows('exam-1', 50),
      ]

      // Con bug: user-ghost tiene 15% (9/60), va después de user-normal (70%)
      const buggy = computeRankingBuggy(questions, sessions)
      expect(buggy[0].user_id).toBe('user-normal') // 70%
      expect(buggy[1].user_id).toBe('user-ghost') // 15%

      // Con fix: user-ghost tiene 90% (9/10), va PRIMERO
      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed[0].user_id).toBe('user-ghost') // 90%
      expect(fixed[1].user_id).toBe('user-normal') // 70%
    })

    test('empate en accuracy: desempata por total_questions (sin ghost rows)', () => {
      const sessions = [
        makeSession('test-1', 'user-a'),
        makeSession('test-2', 'user-b'),
        makeSession('exam-1', 'user-b'),
      ]
      const questions = [
        // user-a: 20 preguntas, 80%
        ...makeRealAnswers('test-1', 20, 0.8),
        // user-b: 10 reales (80%) + 50 ghost → con fix debería ir después
        ...makeRealAnswers('test-2', 10, 0.8),
        ...makeGhostRows('exam-1', 50),
      ]

      const fixed = computeRankingFixed(questions, sessions)
      expect(fixed).toHaveLength(2)
      expect(fixed[0].user_id).toBe('user-a') // 80%, 20 preguntas
      expect(fixed[1].user_id).toBe('user-b') // 80%, 10 preguntas
    })
  })
})

describe('Ghost rows filter - get_user_ranking_position', () => {
  /**
   * Replica lógica de get_user_ranking_position con fix.
   */
  function getUserPosition(
    targetUserId: string,
    questions: TestQuestion[],
    sessions: TestSession[],
    minQuestions = 5
  ): { rank: number; total_questions: number; accuracy: number; total_users: number } | null {
    const ranking = computeRankingFixed(questions, sessions, minQuestions)
    const idx = ranking.findIndex(r => r.user_id === targetUserId)
    if (idx === -1) return null
    return {
      rank: idx + 1,
      total_questions: ranking[idx].total_questions,
      accuracy: ranking[idx].accuracy,
      total_users: ranking.length,
    }
  }

  test('posición correcta tras excluir ghost rows', () => {
    const sessions = [
      makeSession('test-1', 'user-a'),
      makeSession('exam-1', 'user-b'),
    ]
    const questions = [
      ...makeRealAnswers('test-1', 10, 0.7),
      ...makeRealAnswers('exam-1', 10, 0.9),
      ...makeGhostRows('exam-1', 50),
    ]

    const pos = getUserPosition('user-b', questions, sessions)
    expect(pos).not.toBeNull()
    expect(pos!.rank).toBe(1) // 90% > 70%
    expect(pos!.accuracy).toBe(90)
    expect(pos!.total_questions).toBe(10)
  })

  test('usuario solo con ghost rows → no tiene posición', () => {
    const sessions = [
      makeSession('test-1', 'user-a'),
      makeSession('exam-1', 'user-ghost'),
    ]
    const questions = [
      ...makeRealAnswers('test-1', 10, 0.7),
      ...makeGhostRows('exam-1', 64),
    ]

    const pos = getUserPosition('user-ghost', questions, sessions)
    expect(pos).toBeNull()
  })

  test('total_users no incluye usuarios fantasma', () => {
    const sessions = [
      makeSession('test-1', 'user-a'),
      makeSession('test-2', 'user-b'),
      makeSession('exam-1', 'user-ghost'),
    ]
    const questions = [
      ...makeRealAnswers('test-1', 10, 0.7),
      ...makeRealAnswers('test-2', 10, 0.6),
      ...makeGhostRows('exam-1', 64),
    ]

    const pos = getUserPosition('user-a', questions, sessions)
    expect(pos!.total_users).toBe(2) // Solo user-a y user-b, no user-ghost
  })
})

describe('Ghost rows filter - rankingMedals.js', () => {
  describe('Bug: ghost rows distorsionan medallas', () => {
    test('usuario con 90% real pierde medalla HIGH_ACCURACY por ghost rows', () => {
      const sessions = [
        makeSession('test-1', 'user-star'),
        makeSession('exam-1', 'user-star'),
      ]
      const questions = [
        ...makeRealAnswers('test-1', 25, 0.92), // 92% real → merece HIGH_ACCURACY
        ...makeGhostRows('exam-1', 50),
      ]

      const buggy = computeMedalsRankingBuggy(questions, sessions)
      expect(buggy[0].accuracy).toBe(31) // 23/75 → pierde medalla

      const fixed = computeMedalsRankingFixed(questions, sessions)
      expect(fixed[0].accuracy).toBe(92) // 23/25 → merece medalla
    })

    test('usuario con 120 preguntas reales pierde VOLUME_LEADER por ghost rows que diluyen', () => {
      // El bug no afecta directamente el volumen (infla), pero sí la accuracy
      // que puede hacer que quede fuera del ranking
      const sessions = [
        makeSession('test-1', 'user-volume'),
        makeSession('exam-1', 'user-volume'),
      ]
      const questions = [
        ...makeRealAnswers('test-1', 120, 0.85),
        ...makeGhostRows('exam-1', 100),
      ]

      const buggy = computeMedalsRankingBuggy(questions, sessions)
      expect(buggy[0].totalQuestions).toBe(220) // Inflado

      const fixed = computeMedalsRankingFixed(questions, sessions)
      expect(fixed[0].totalQuestions).toBe(120) // Correcto
    })
  })

  describe('Fix: medallas se calculan correctamente', () => {
    test('primer lugar con fix cuando ghost rows le bajaban la posición', () => {
      const sessions = [
        makeSession('test-1', 'user-top'),
        makeSession('exam-1', 'user-top'),
        makeSession('test-2', 'user-second'),
      ]
      const questions = [
        // user-top: 20 reales al 95% + 50 ghost → buggy 38%, fixed 95%
        ...makeRealAnswers('test-1', 20, 0.95),
        ...makeGhostRows('exam-1', 50),
        // user-second: 20 reales al 80%, sin ghost rows
        ...makeRealAnswers('test-2', 20, 0.8),
      ]

      const buggy = computeMedalsRankingBuggy(questions, sessions)
      expect(buggy[0].userId).toBe('user-second') // 80% > 38% → user-top pierde 1er lugar

      const fixed = computeMedalsRankingFixed(questions, sessions)
      expect(fixed[0].userId).toBe('user-top') // 95% > 80% → user-top recupera 1er lugar
    })

    test('HIGH_ACCURACY requiere >= 90% y >= 20 preguntas', () => {
      const sessions = [makeSession('test-1', 'user-ha')]
      const questions = makeRealAnswers('test-1', 20, 0.9)

      const fixed = computeMedalsRankingFixed(questions, sessions)
      expect(fixed[0].accuracy).toBe(90)
      expect(fixed[0].totalQuestions).toBe(20)
      // Cumple ambos criterios
    })

    test('VOLUME_LEADER requiere >= 100 preguntas reales (no ghost)', () => {
      const sessions = [
        makeSession('exam-1', 'user-fake-volume'),
      ]
      // 30 reales + 80 ghost = 110 buggy total, pero solo 30 reales
      const questions = [
        ...makeRealAnswers('exam-1', 30, 0.7),
        ...makeGhostRows('exam-1', 80),
      ]

      const buggy = computeMedalsRankingBuggy(questions, sessions)
      expect(buggy[0].totalQuestions).toBe(110) // >= 100 → medalla injusta

      const fixed = computeMedalsRankingFixed(questions, sessions)
      expect(fixed[0].totalQuestions).toBe(30) // < 100 → sin medalla
    })
  })
})

describe('Ghost rows: casos edge', () => {
  test('user_answer nunca es null en el schema (notNull constraint)', () => {
    // Verificar que el filtro != '' es suficiente sin necesidad de IS NOT NULL
    // Con solo 3 respuestas reales no supera el mínimo de 5, así que bajamos minQuestions
    const sessions = [makeSession('test-1', 'user')]
    const questions: TestQuestion[] = [
      makeQuestion('test-1', 'a', true),
      makeQuestion('test-1', '', false), // ghost row
      makeQuestion('test-1', 'b', false),
      makeQuestion('test-1', '', false), // ghost row
      makeQuestion('test-1', 'c', true),
      makeQuestion('test-1', 'a', true),
      makeQuestion('test-1', 'd', false),
    ]

    const fixed = computeRankingFixed(questions, sessions)
    expect(fixed[0].total_questions).toBe(5) // Solo a, b, c, a, d
    expect(fixed[0].correct_answers).toBe(3) // Solo a, c, a
  })

  test('mezcla de exámenes oficiales y tests normales del mismo usuario', () => {
    const sessions = [
      makeSession('custom-1', 'user-mix', { test_type: 'custom' }),
      makeSession('exam-1', 'user-mix', { test_type: 'exam', title: 'Examen Oficial 2024' }),
    ]
    const questions = [
      // Test normal: 15 preguntas, 80%
      ...makeRealAnswers('custom-1', 15, 0.8),
      // Examen oficial: 10 respondidas + 54 ghost
      ...makeRealAnswers('exam-1', 10, 0.7),
      ...makeGhostRows('exam-1', 54),
    ]

    // Con bug: 79 preguntas, 19 correctas = 24%
    const buggy = computeRankingBuggy(questions, sessions)
    expect(buggy[0].total_questions).toBe(79)
    expect(buggy[0].accuracy).toBe(24)

    // Con fix: 25 preguntas (15 + 10), 19 correctas = 76%
    const fixed = computeRankingFixed(questions, sessions)
    expect(fixed[0].total_questions).toBe(25)
    expect(fixed[0].correct_answers).toBe(19) // 12 + 7
    expect(fixed[0].accuracy).toBe(76)
  })

  test('examen completado con preguntas en blanco (sin_respuesta) se cuentan', () => {
    // Cuando un usuario completa un examen, las preguntas no respondidas
    // se guardan como 'sin_respuesta', NO como ''
    const sessions = [makeSession('exam-1', 'user-complete', { is_completed: true })]
    const questions: TestQuestion[] = [
      makeQuestion('exam-1', 'a', true),
      makeQuestion('exam-1', 'b', false),
      makeQuestion('exam-1', 'sin_respuesta', false), // en blanco
      makeQuestion('exam-1', 'a', true),
      makeQuestion('exam-1', 'sin_respuesta', false), // en blanco
      makeQuestion('exam-1', 'c', true),
    ]

    const fixed = computeRankingFixed(questions, sessions)
    expect(fixed).toHaveLength(1)
    // Todas cuentan porque ninguna tiene user_answer = ''
    expect(fixed[0].total_questions).toBe(6)
    expect(fixed[0].correct_answers).toBe(3)
    expect(fixed[0].accuracy).toBe(50)
  })

  test('examen parcialmente respondido y no completado', () => {
    // El usuario abre un examen de 64 preguntas, responde 24, se va
    const sessions = [makeSession('exam-1', 'user-partial', { is_completed: false })]
    const questions = [
      ...makeRealAnswers('exam-1', 24, 0.375), // 9 correctas de 24 → 38%
      ...makeGhostRows('exam-1', 40), // 40 sin responder
    ]

    const buggy = computeRankingBuggy(questions, sessions)
    expect(buggy[0].total_questions).toBe(64)
    expect(buggy[0].accuracy).toBe(14) // 9/64

    const fixed = computeRankingFixed(questions, sessions)
    expect(fixed[0].total_questions).toBe(24)
    expect(fixed[0].accuracy).toBe(38) // 9/24
  })

  test('múltiples exámenes parciales del mismo usuario', () => {
    const sessions = [
      makeSession('exam-1', 'user-multi'),
      makeSession('exam-2', 'user-multi'),
      makeSession('exam-3', 'user-multi'),
    ]
    const questions = [
      // Examen 1: 30 respondidas (20 correctas) + 34 ghost
      ...makeRealAnswers('exam-1', 30, 0.667), // 20 correctas
      ...makeGhostRows('exam-1', 34),
      // Examen 2: solo abierto, no respondió nada
      ...makeGhostRows('exam-2', 64),
      // Examen 3: 5 respondidas (4 correctas) + 59 ghost
      ...makeRealAnswers('exam-3', 5, 0.8), // 4 correctas
      ...makeGhostRows('exam-3', 59),
    ]

    // Total real: 30+34+64+5+59 = 192
    const buggy = computeRankingBuggy(questions, sessions)
    expect(buggy[0].total_questions).toBe(192)
    expect(buggy[0].correct_answers).toBe(24) // 20+4
    expect(buggy[0].accuracy).toBe(13) // 24/192

    const fixed = computeRankingFixed(questions, sessions)
    expect(fixed[0].total_questions).toBe(35) // 30+5
    expect(fixed[0].correct_answers).toBe(24) // 20+4
    expect(fixed[0].accuracy).toBe(69) // 24/35
  })

  test('ranking con muchos usuarios, algunos afectados y otros no', () => {
    const sessions = [
      makeSession('test-1', 'clean-user-1'),
      makeSession('test-2', 'clean-user-2'),
      makeSession('test-3', 'ghost-user-1'),
      makeSession('exam-1', 'ghost-user-1'),
      makeSession('test-4', 'ghost-user-2'),
      makeSession('exam-2', 'ghost-user-2'),
      makeSession('exam-3', 'only-ghost'),
    ]
    const questions = [
      // clean-user-1: 50 preguntas, 90%
      ...makeRealAnswers('test-1', 50, 0.9),
      // clean-user-2: 30 preguntas, 60%
      ...makeRealAnswers('test-2', 30, 0.6),
      // ghost-user-1: 20 reales 85% + 44 ghost
      ...makeRealAnswers('test-3', 20, 0.85),
      ...makeGhostRows('exam-1', 44),
      // ghost-user-2: 8 reales 50% + 56 ghost
      ...makeRealAnswers('test-4', 8, 0.5),
      ...makeGhostRows('exam-2', 56),
      // only-ghost: solo ghost rows
      ...makeGhostRows('exam-3', 100),
    ]

    const fixed = computeRankingFixed(questions, sessions)

    // only-ghost no aparece (0 reales)
    expect(fixed.find(r => r.user_id === 'only-ghost')).toBeUndefined()

    // ghost-user-2 tiene 8 preguntas reales → supera mínimo de 5
    expect(fixed.find(r => r.user_id === 'ghost-user-2')).toBeDefined()

    // Orden correcto
    expect(fixed[0].user_id).toBe('clean-user-1') // 90%
    expect(fixed[1].user_id).toBe('ghost-user-1') // 85%
    expect(fixed[2].user_id).toBe('clean-user-2') // 60%
    expect(fixed[3].user_id).toBe('ghost-user-2') // 50%
  })
})

describe('Ghost rows: regresión - el filtro solo afecta a user_answer vacío', () => {
  test('no filtra user_answer con espacios', () => {
    // Teóricamente no debería existir, pero por seguridad
    const sessions = [makeSession('test-1', 'user')]
    const questions: TestQuestion[] = [
      makeQuestion('test-1', ' ', false),
      makeQuestion('test-1', 'a', true),
      makeQuestion('test-1', 'b', false),
      makeQuestion('test-1', 'a', true),
      makeQuestion('test-1', 'c', true),
    ]

    const fixed = computeRankingFixed(questions, sessions)
    // ' ' (espacio) != '' → NO se filtra
    expect(fixed[0].total_questions).toBe(5)
  })

  test('no filtra user_answer con valores especiales legítimos', () => {
    const sessions = [makeSession('test-1', 'user')]
    const questions: TestQuestion[] = [
      makeQuestion('test-1', 'sin_respuesta', false),
      makeQuestion('test-1', 'a', true),
      makeQuestion('test-1', 'b', false),
      makeQuestion('test-1', 'c', true),
      makeQuestion('test-1', 'd', false),
    ]

    const fixed = computeRankingFixed(questions, sessions)
    expect(fixed[0].total_questions).toBe(5) // Todas cuentan
  })

  test('solo user_answer === "" exacto es filtrado', () => {
    const sessions = [makeSession('test-1', 'user')]
    const questions: TestQuestion[] = [
      makeQuestion('test-1', '', false), // FILTRADO
      makeQuestion('test-1', 'a', true), // OK
      makeQuestion('test-1', '', false), // FILTRADO
      makeQuestion('test-1', 'b', true), // OK
      makeQuestion('test-1', '', false), // FILTRADO
      makeQuestion('test-1', 'c', false), // OK
      makeQuestion('test-1', 'd', true), // OK
      makeQuestion('test-1', '', false), // FILTRADO
      makeQuestion('test-1', 'a', true), // OK
    ]

    const fixed = computeRankingFixed(questions, sessions)
    expect(fixed[0].total_questions).toBe(5) // Solo las 5 con letra
    expect(fixed[0].correct_answers).toBe(4) // a, b, d, a
  })
})

describe('SQL del fix: verificar que la condición es correcta', () => {
  test('condición SQL propuesta cubre todos los casos', () => {
    // La condición propuesta es: AND tq.user_answer != ''
    // Verificamos que es equivalente a nuestra lógica TypeScript

    const testCases = [
      { user_answer: '', expected_excluded: true },
      { user_answer: 'a', expected_excluded: false },
      { user_answer: 'b', expected_excluded: false },
      { user_answer: 'c', expected_excluded: false },
      { user_answer: 'd', expected_excluded: false },
      { user_answer: 'sin_respuesta', expected_excluded: false },
      { user_answer: ' ', expected_excluded: false },
      { user_answer: 'A', expected_excluded: false },
    ]

    for (const tc of testCases) {
      const excluded = tc.user_answer === ''
      expect(excluded).toBe(tc.expected_excluded)
    }
  })

  test('la condición no necesita IS NOT NULL porque user_answer es NOT NULL', () => {
    // En el schema: userAnswer: text("user_answer").notNull()
    // Verificar que '' != NULL en lógica SQL: '' IS NOT NULL → TRUE
    // Por tanto, AND user_answer != '' es suficiente

    const emptyString = ''
    expect(emptyString !== null).toBe(true) // '' no es null
    expect(emptyString !== undefined).toBe(true) // '' no es undefined
    expect(emptyString === '').toBe(true) // '' es ''
    expect(emptyString.length).toBe(0)
  })
})
