/**
 * Simulación conductual del flujo de durabilidad del examen (fix caso Marta 21/07/2026).
 * Reproduce cómo ExamLayout usa localAnswerStore + mergeExamAnswers de punta a punta,
 * SIN montar el componente: responder → espejar → (fallar red) → cerrar pestaña →
 * reanudar → rehidratar → recuperar TODO. Es la prueba de que "no se pierde nada".
 */
import {
  saveLocalExamAnswers,
  loadLocalExamAnswers,
  clearLocalExamAnswers,
  mergeExamAnswers,
  type ExamAnswers,
} from '@/lib/exam/localAnswerStore'

const TEST_ID = 'exam-marta-sim'

beforeEach(() => window.localStorage.clear())

/** Simula el efecto de ExamLayout: cada respuesta espeja el mapa COMPLETO en localStorage. */
function answer(current: ExamAnswers, index: number, option: string): ExamAnswers {
  const next = { ...current, [index]: option }
  saveLocalExamAnswers(TEST_ID, next) // espejo inmediato, como en handleAnswerSelect
  return next
}

describe('durabilidad end-to-end del examen', () => {
  it('con TODA la red caída (0 guardados server-side), reanudar recupera las 64 respuestas', () => {
    // El usuario responde 64 preguntas; NINGÚN /api/exam/answer llega al servidor (red caída).
    let answers: ExamAnswers = {}
    const opts = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 64; i++) answers = answer(answers, i, opts[i % 4])

    // Cierra la pestaña / recarga: el estado React se pierde. El servidor NO tiene nada.
    const serverAnswers: ExamAnswers | null = null // loadSavedAnswers → null (nada guardado)

    // Al reanudar, ExamLayout rehidrata: merge(server, local).
    const local = loadLocalExamAnswers(TEST_ID)
    const hydrated = mergeExamAnswers(serverAnswers, local)

    expect(Object.keys(hydrated)).toHaveLength(64)
    expect(hydrated[0]).toBe('a')
    expect(hydrated[63]).toBe('d')
  })

  it('red intermitente: servidor tiene un subconjunto, local tiene todo → no se pierde ninguna', () => {
    let answers: ExamAnswers = {}
    for (let i = 0; i < 10; i++) answers = answer(answers, i, 'b')

    // El servidor solo llegó a persistir las respuestas pares (las impares fallaron en red).
    const serverAnswers: ExamAnswers = {}
    for (let i = 0; i < 10; i += 2) serverAnswers[i] = 'b'

    const hydrated = mergeExamAnswers(serverAnswers, loadLocalExamAnswers(TEST_ID))
    expect(Object.keys(hydrated)).toHaveLength(10) // las 10, no solo las 5 del servidor
  })

  it('cambiar una respuesta antes de reanudar: local (última intención) gana sobre el servidor', () => {
    let answers: ExamAnswers = {}
    answers = answer(answers, 0, 'a') // primero marcó A (llegó al servidor)
    const serverAnswers: ExamAnswers = { 0: 'a' }
    answers = answer(answers, 0, 'c') // la cambió a C (no llegó al servidor)

    const hydrated = mergeExamAnswers(serverAnswers, loadLocalExamAnswers(TEST_ID))
    expect(hydrated[0]).toBe('c') // gana la última elección del usuario
  })

  it('tras validar el examen, se limpia el espejo (no rehidrata un examen cerrado)', () => {
    let answers: ExamAnswers = {}
    for (let i = 0; i < 5; i++) answers = answer(answers, i, 'a')
    expect(loadLocalExamAnswers(TEST_ID)).not.toBeNull()

    clearLocalExamAnswers(TEST_ID) // como en el path de validate() exitoso
    expect(loadLocalExamAnswers(TEST_ID)).toBeNull()
    expect(mergeExamAnswers(null, loadLocalExamAnswers(TEST_ID))).toEqual({})
  })
})
