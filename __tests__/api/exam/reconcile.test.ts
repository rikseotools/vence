// Tests de la lógica PURA de reconciliación del modo examen
// (lib/api/exam/reconcile.ts). La BD es la fuente autoritativa de la nota; el
// batch indexado por posición puede desalinearse. Caso real reproducido:
// Isabel (16/06/2026) vio 0/71 en pantalla con la BD en 62/71.

import {
  summarizeDbScore,
  overlayResultsWithDb,
  indexDbRowsByQuestionId,
  scoreDivergence,
  type DbAnswerRow,
  type ExamQuestionResult,
} from '@/lib/api/exam/reconcile'

const row = (questionId: string, userAnswer: string, isCorrect: boolean): DbAnswerRow => ({
  questionId,
  userAnswer,
  isCorrect,
})

const result = (
  questionId: string,
  userAnswer: string | null,
  correctAnswer: string,
  isCorrect: boolean,
): ExamQuestionResult => ({
  questionId,
  userAnswer,
  correctAnswer,
  correctIndex: correctAnswer.charCodeAt(0) - 97,
  isCorrect,
})

describe('summarizeDbScore — nota autoritativa desde test_questions', () => {
  it('cuenta correctas, respondidas y porcentaje', () => {
    const rows = [
      row('q1', 'a', true),
      row('q2', 'b', false),
      row('q3', '', false), // en blanco
    ]
    expect(summarizeDbScore(rows, 3)).toEqual({
      totalQuestions: 3,
      totalAnswered: 2,
      totalCorrect: 1,
      percentage: 33,
    })
  })

  it('totalQuestions lo fija el tamaño del examen, no el nº de filas (save realtime perdido)', () => {
    // Solo 2 filas en BD pero el examen tenía 3 preguntas
    const rows = [row('q1', 'a', true), row('q2', 'b', true)]
    const s = summarizeDbScore(rows, 3)
    expect(s.totalCorrect).toBe(2)
    expect(s.totalQuestions).toBe(3)
    expect(s.percentage).toBe(67)
  })

  it('caso Isabel: BD con 62 correctas de 71 → nota autoritativa correcta', () => {
    const rows: DbAnswerRow[] = []
    for (let i = 0; i < 62; i++) rows.push(row(`c${i}`, 'a', true))
    for (let i = 0; i < 9; i++) rows.push(row(`w${i}`, 'b', false))
    const s = summarizeDbScore(rows, 71)
    expect(s.totalCorrect).toBe(62)
    expect(s.totalAnswered).toBe(71)
    expect(s.percentage).toBe(87)
  })

  it('examen vacío → 0% sin dividir por cero', () => {
    expect(summarizeDbScore([], 0)).toEqual({
      totalQuestions: 0,
      totalAnswered: 0,
      totalCorrect: 0,
      percentage: 0,
    })
  })
})

describe('overlayResultsWithDb — la BD gana sobre el batch desalineado', () => {
  it('caso Isabel: batch dice todo mal, la BD tiene la respuesta buena → gana la BD', () => {
    // El batch (desalineado) emparejó respuestas con preguntas equivocadas:
    // dice que q1 y q2 están mal. La BD (realtime, fiable) tiene q1=a (correcta).
    const payload = [
      result('q1', 'b', 'a', false), // batch: usuario respondió b (mal)
      result('q2', 'c', 'b', false), // batch: usuario respondió c (mal)
    ]
    const db = indexDbRowsByQuestionId([row('q1', 'a', true), row('q2', 'b', true)])
    const merged = overlayResultsWithDb(payload, db)
    expect(merged[0]).toMatchObject({ questionId: 'q1', userAnswer: 'a', isCorrect: true })
    expect(merged[1]).toMatchObject({ questionId: 'q2', userAnswer: 'b', isCorrect: true })
  })

  it('happy path: batch coincide con BD → resultado idéntico', () => {
    const payload = [result('q1', 'a', 'a', true), result('q2', 'b', 'b', true)]
    const db = indexDbRowsByQuestionId([row('q1', 'a', true), row('q2', 'b', true)])
    expect(overlayResultsWithDb(payload, db)).toEqual(payload)
  })

  it('save realtime perdido (BD sin la pregunta) → se conserva el batch', () => {
    const payload = [result('q1', 'a', 'a', true)]
    const db = indexDbRowsByQuestionId([]) // BD no tiene q1
    expect(overlayResultsWithDb(payload, db)).toEqual(payload)
  })

  it('BD en blanco para la pregunta → se conserva el batch (no machaca con vacío)', () => {
    const payload = [result('q1', 'a', 'a', true)]
    const db = indexDbRowsByQuestionId([row('q1', '', false)])
    expect(overlayResultsWithDb(payload, db)[0]).toMatchObject({ userAnswer: 'a', isCorrect: true })
  })

  it('mantiene el ORDEN del batch (el cliente casa por índice)', () => {
    const payload = [result('q3', 'a', 'a', true), result('q1', 'b', 'b', true)]
    const db = indexDbRowsByQuestionId([row('q1', 'b', true), row('q3', 'a', true)])
    const merged = overlayResultsWithDb(payload, db)
    expect(merged.map(r => r.questionId)).toEqual(['q3', 'q1'])
  })

  // T-277: la BD guarda SIEMPRE en coordenadas ORIGINALES (0=A del banco). Si esta función
  // inyectara `db.userAnswer` tal cual sobre un examen barajado, el cliente resaltaría el
  // botón EQUIVOCADO en su pantalla de revisión — la nota seguiría bien (isCorrect viene
  // de la BD también), pero la opción marcada como "la que elegiste" sería otra distinta.
  describe('examen BARAJADO: la BD gana, pero traducida a coordenadas MOSTRADAS', () => {
    it('la respuesta de la BD (original) se traduce al orden que el cliente tiene delante', () => {
      // order=[2,0,1,3]: el original 'a' (índice 0) está mostrado en la posición 1 ('b')
      const payload = [result('q1', 'x', 'z', false)] // lo que mandó el batch da igual: gana la BD
      const db = indexDbRowsByQuestionId([row('q1', 'a', true)]) // BD: original 'a'
      const merged = overlayResultsWithDb(payload, db, { q1: [2, 0, 1, 3] })
      expect(merged[0]).toMatchObject({ questionId: 'q1', userAnswer: 'b', isCorrect: true })
    })

    it('sin optionOrders (parámetro omitido): identidad total — mismo resultado que antes de T-277', () => {
      const payload = [result('q1', 'b', 'a', false)]
      const db = indexDbRowsByQuestionId([row('q1', 'a', true)])
      expect(overlayResultsWithDb(payload, db)).toEqual(overlayResultsWithDb(payload, db, {}))
    })

    it('la pregunta NO tiene orden en el mapa (no se barajó ESA en concreto): identidad', () => {
      const payload = [result('q1', 'x', 'z', false)]
      const db = indexDbRowsByQuestionId([row('q1', 'c', true)])
      const merged = overlayResultsWithDb(payload, db, { 'otra-pregunta': [1, 0] })
      expect(merged[0].userAnswer).toBe('c') // sin traducir: no había orden para q1
    })

    it('dos preguntas del mismo examen con órdenes DISTINTOS: cada una se traduce con el suyo', () => {
      const payload = [result('q1', 'x', 'x', false), result('q2', 'x', 'x', false)]
      const db = indexDbRowsByQuestionId([row('q1', 'a', true), row('q2', 'b', true)])
      const merged = overlayResultsWithDb(payload, db, { q1: [1, 0], q2: [0, 2, 1] })
      // q1: order=[1,0] → original 'a' (0) está en posición 1 → 'b'
      expect(merged[0].userAnswer).toBe('b')
      // q2: order=[0,2,1] → original 'b' (1) está en posición 2 → 'c'
      expect(merged[1].userAnswer).toBe('c')
    })
  })
})

describe('scoreDivergence — señal de observabilidad', () => {
  it('detecta divergencia (caso Isabel: batch 0, BD 62)', () => {
    expect(scoreDivergence(0, 62)).toEqual({ diverged: true, delta: 62 })
  })

  it('happy path: sin divergencia', () => {
    expect(scoreDivergence(62, 62)).toEqual({ diverged: false, delta: 0 })
  })

  it('delta negativo si el batch contó de más', () => {
    expect(scoreDivergence(5, 3)).toEqual({ diverged: true, delta: -2 })
  })
})

describe('indexDbRowsByQuestionId', () => {
  it('descarta filas sin questionId', () => {
    const map = indexDbRowsByQuestionId([row('q1', 'a', true), { questionId: null, userAnswer: 'b', isCorrect: false }])
    expect(map.size).toBe(1)
    expect(map.get('q1')).toBeDefined()
  })
})
