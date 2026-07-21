/**
 * Tests de lib/exam/localAnswerStore — persistencia durable de respuestas de examen.
 * Cada caso ancla una garantía de robustez del fix del caso Marta (21/07/2026):
 * las respuestas de examen deben sobrevivir a red caída / reload / cierre de pestaña.
 */
import {
  saveLocalExamAnswers,
  loadLocalExamAnswers,
  clearLocalExamAnswers,
  mergeExamAnswers,
  type ExamAnswers,
} from '@/lib/exam/localAnswerStore'

const TEST_ID = '3260627f-2018-4a5e-8234-e6f07015abb9'

beforeEach(() => {
  window.localStorage.clear()
})

describe('save/load roundtrip', () => {
  it('persiste y recupera el mapa de respuestas', () => {
    const answers: ExamAnswers = { 0: 'a', 1: 'c', 2: 'b' }
    saveLocalExamAnswers(TEST_ID, answers)
    expect(loadLocalExamAnswers(TEST_ID)).toEqual(answers)
  })

  it('devuelve null si no hay nada guardado', () => {
    expect(loadLocalExamAnswers(TEST_ID)).toBeNull()
  })

  it('aísla por testId (no hay bleed entre exámenes)', () => {
    saveLocalExamAnswers('exam-A', { 0: 'a' })
    saveLocalExamAnswers('exam-B', { 0: 'd' })
    expect(loadLocalExamAnswers('exam-A')).toEqual({ 0: 'a' })
    expect(loadLocalExamAnswers('exam-B')).toEqual({ 0: 'd' })
  })

  it('el último save sobrescribe (mapa completo, no merge)', () => {
    saveLocalExamAnswers(TEST_ID, { 0: 'a', 1: 'b' })
    saveLocalExamAnswers(TEST_ID, { 0: 'a', 1: 'b', 2: 'c' })
    expect(loadLocalExamAnswers(TEST_ID)).toEqual({ 0: 'a', 1: 'b', 2: 'c' })
  })
})

describe('robustez ante datos malos', () => {
  it('JSON corrupto → null (no lanza)', () => {
    window.localStorage.setItem(`exam_answers:${TEST_ID}`, '{no es json')
    expect(loadLocalExamAnswers(TEST_ID)).toBeNull()
  })

  it('versión desconocida → null (invalidación por shape)', () => {
    window.localStorage.setItem(
      `exam_answers:${TEST_ID}`,
      JSON.stringify({ v: 99, answers: { 0: 'a' }, updatedAt: Date.now() }),
    )
    expect(loadLocalExamAnswers(TEST_ID)).toBeNull()
  })

  it('más viejo que 7 días → null (caducado)', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    saveLocalExamAnswers(TEST_ID, { 0: 'a' }, eightDaysAgo)
    expect(loadLocalExamAnswers(TEST_ID)).toBeNull()
  })

  it('dentro de 7 días → se conserva', () => {
    const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60 * 1000
    saveLocalExamAnswers(TEST_ID, { 0: 'a' }, sixDaysAgo)
    expect(loadLocalExamAnswers(TEST_ID)).toEqual({ 0: 'a' })
  })

  it('sanea claves/valores inválidos (negativas, no-string, vacías)', () => {
    window.localStorage.setItem(
      `exam_answers:${TEST_ID}`,
      JSON.stringify({ v: 1, answers: { 0: 'a', '-1': 'b', 2: '', 3: 5, 4: 'd' }, updatedAt: Date.now() }),
    )
    expect(loadLocalExamAnswers(TEST_ID)).toEqual({ 0: 'a', 4: 'd' })
  })

  it('mapa totalmente vacío tras sanear → null', () => {
    window.localStorage.setItem(
      `exam_answers:${TEST_ID}`,
      JSON.stringify({ v: 1, answers: {}, updatedAt: Date.now() }),
    )
    expect(loadLocalExamAnswers(TEST_ID)).toBeNull()
  })

  it('testId vacío → no persiste ni lee', () => {
    saveLocalExamAnswers('', { 0: 'a' })
    expect(loadLocalExamAnswers('')).toBeNull()
  })
})

describe('clear', () => {
  it('borra el espejo', () => {
    saveLocalExamAnswers(TEST_ID, { 0: 'a' })
    clearLocalExamAnswers(TEST_ID)
    expect(loadLocalExamAnswers(TEST_ID)).toBeNull()
  })

  it('clear de una clave inexistente no lanza', () => {
    expect(() => clearLocalExamAnswers('no-existe')).not.toThrow()
  })
})

describe('mergeExamAnswers', () => {
  it('local gana en conflicto (refleja lo marcado en este dispositivo)', () => {
    expect(mergeExamAnswers({ 0: 'a', 1: 'b' }, { 1: 'c', 2: 'd' })).toEqual({ 0: 'a', 1: 'c', 2: 'd' })
  })

  it('sin local → queda el servidor (reanudar en otro dispositivo)', () => {
    expect(mergeExamAnswers({ 0: 'a' }, null)).toEqual({ 0: 'a' })
  })

  it('sin servidor → quedan las locales (recupera guardados fallidos)', () => {
    expect(mergeExamAnswers(null, { 0: 'a' })).toEqual({ 0: 'a' })
  })

  it('ambos vacíos → objeto vacío', () => {
    expect(mergeExamAnswers(null, null)).toEqual({})
  })

  it('nunca descarta una respuesta existente (unión)', () => {
    const merged = mergeExamAnswers({ 0: 'a', 3: 'a' }, { 1: 'b', 2: 'c' })
    expect(Object.keys(merged).sort()).toEqual(['0', '1', '2', '3'])
  })
})
