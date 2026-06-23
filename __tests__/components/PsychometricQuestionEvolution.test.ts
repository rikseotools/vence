// __tests__/components/PsychometricQuestionEvolution.test.ts
// Tests unitarios de la lógica pura de PsychometricQuestionEvolution

// Mock supabase client (not needed for pure logic tests)
jest.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }) }) }),
  }),
}))

import {
  calcularRachaMaxima,
  calcularMejoraTiempo,
  calcularAnalisisInteraccion,
  calcularAnalisisTemporal,
  calcularPatronesRendimiento,
  calcularEstadisticasAvanzadas,
  calculateCompleteEvolution,
} from '@/components/PsychometricQuestionEvolution'

// ============================================
// HELPERS
// ============================================

let idCounter = 0

function makeEntry(overrides: Partial<{
  id: string
  is_correct: boolean
  time_spent_seconds: number
  created_at: string
  test_session_id: string
  question_order: number
  user_answer: number
  interaction_data: any
  psychometric_test_sessions: { session_type: string } | null
}> = {}) {
  return {
    id: overrides.id ?? `test-id-${++idCounter}`,
    user_answer: overrides.user_answer ?? 0,
    is_correct: overrides.is_correct ?? false,
    time_spent_seconds: overrides.time_spent_seconds ?? 30,
    created_at: overrides.created_at ?? '2026-04-20T10:00:00Z',
    test_session_id: overrides.test_session_id ?? 'session-1',
    question_order: overrides.question_order ?? 1,
    interaction_data: overrides.interaction_data ?? null,
    psychometric_test_sessions: overrides.psychometric_test_sessions ?? null,
  }
}

const CURRENT_RESULT = { isCorrect: true, timeSpent: 0, answer: 2 }

// ============================================
// calcularRachaMaxima
// ============================================
describe('calcularRachaMaxima', () => {
  it('devuelve 0 para historial vacío', () => {
    expect(calcularRachaMaxima([], true)).toBe(0)
    expect(calcularRachaMaxima([], false)).toBe(0)
  })

  it('cuenta racha de correctas', () => {
    const history = [
      makeEntry({ is_correct: true }),
      makeEntry({ is_correct: true }),
      makeEntry({ is_correct: true }),
      makeEntry({ is_correct: false }),
      makeEntry({ is_correct: true }),
    ]
    expect(calcularRachaMaxima(history, true)).toBe(3)
  })

  it('cuenta racha de incorrectas', () => {
    const history = [
      makeEntry({ is_correct: false }),
      makeEntry({ is_correct: false }),
      makeEntry({ is_correct: true }),
      makeEntry({ is_correct: false }),
    ]
    expect(calcularRachaMaxima(history, false)).toBe(2)
  })

  it('toda la historia correcta = racha == length', () => {
    const history = Array.from({ length: 5 }, () => makeEntry({ is_correct: true }))
    expect(calcularRachaMaxima(history, true)).toBe(5)
  })

  it('una sola entrada', () => {
    expect(calcularRachaMaxima([makeEntry({ is_correct: true })], true)).toBe(1)
    expect(calcularRachaMaxima([makeEntry({ is_correct: true })], false)).toBe(0)
  })
})

// ============================================
// calcularMejoraTiempo
// ============================================
describe('calcularMejoraTiempo', () => {
  it('devuelve null con menos de 2 entradas', () => {
    expect(calcularMejoraTiempo([])).toBeNull()
    expect(calcularMejoraTiempo([makeEntry()])).toBeNull()
  })

  it('detecta mejora de tiempo (más rápido)', () => {
    const history = [
      makeEntry({ time_spent_seconds: 40 }),
      makeEntry({ time_spent_seconds: 30 }),
    ]
    const result = calcularMejoraTiempo(history)
    expect(result).not.toBeNull()
    expect(result!.mejoro).toBe(true)
    expect(result!.segundos).toBe(10)
  })

  it('detecta empeoramiento de tiempo (más lento)', () => {
    const history = [
      makeEntry({ time_spent_seconds: 20 }),
      makeEntry({ time_spent_seconds: 40 }),
    ]
    const result = calcularMejoraTiempo(history)
    expect(result).not.toBeNull()
    expect(result!.mejoro).toBe(false)
    expect(result!.segundos).toBe(20)
  })

  it('devuelve null si diferencia < 5s (tolerancia)', () => {
    const history = [
      makeEntry({ time_spent_seconds: 30 }),
      makeEntry({ time_spent_seconds: 28 }),
    ]
    expect(calcularMejoraTiempo(history)).toBeNull()
  })

  it('devuelve null si tiempos anteriores son 0', () => {
    const history = [
      makeEntry({ time_spent_seconds: 0 }),
      makeEntry({ time_spent_seconds: 30 }),
    ]
    expect(calcularMejoraTiempo(history)).toBeNull()
  })

  it('promedia tiempos anteriores con 3+ entradas', () => {
    const history = [
      makeEntry({ time_spent_seconds: 40 }),
      makeEntry({ time_spent_seconds: 50 }),
      makeEntry({ time_spent_seconds: 60 }),
      makeEntry({ time_spent_seconds: 20 }), // último: mucho más rápido que promedio 50
    ]
    const result = calcularMejoraTiempo(history)
    expect(result).not.toBeNull()
    expect(result!.mejoro).toBe(true)
    expect(result!.promedioAnterior).toBe(50)
    expect(result!.segundos).toBe(30)
  })
})

// ============================================
// calcularAnalisisInteraccion
// ============================================
describe('calcularAnalisisInteraccion', () => {
  it('devuelve null con historial vacío', () => {
    expect(calcularAnalisisInteraccion([])).toBeNull()
  })

  it('devuelve null si no hay interaction_data', () => {
    expect(calcularAnalisisInteraccion([makeEntry()])).toBeNull()
  })

  it('analiza datos de interacción', () => {
    const history = [
      makeEntry({
        interaction_data: {
          clicks_on_chart: 5,
          hover_time_seconds: 10,
          calculation_method: 'mental_math',
          used_quick_buttons: true,
        },
      }),
      makeEntry({
        interaction_data: {
          clicks_on_chart: 3,
          hover_time_seconds: 8,
          calculation_method: 'mental_math',
          used_quick_buttons: false,
        },
      }),
    ]
    const result = calcularAnalisisInteraccion(history)
    expect(result).not.toBeNull()
    expect(result!.clicksPromedioChart).toBe(4) // (5+3)/2
    expect(result!.tiempoHoverPromedio).toBe(9) // (10+8)/2
    expect(result!.metodoCalculoPreferido).toBe('mental_math')
    expect(result!.usoBotonesRapidos).toBe(50) // 1/2 = 50%
  })
})

// ============================================
// calcularAnalisisTemporal
// ============================================
describe('calcularAnalisisTemporal', () => {
  it('devuelve null con historial vacío', () => {
    expect(calcularAnalisisTemporal([])).toBeNull()
  })

  it('1 intento → frecuencia "1 intento"', () => {
    const result = calcularAnalisisTemporal([
      makeEntry({ created_at: '2026-04-20T10:00:00Z' }),
    ])
    expect(result).not.toBeNull()
    expect(result!.sesionesUnicas).toBe(1)
    // CONTRATO (04/06): history aquí YA incluye el intento actual (ver
    // calculateCompleteEvolution) → las cifras son el total real, no solo previos.
    expect(result!.frecuenciaEstudio).toBe('1 intento')
  })

  it('calcula intervalos con múltiples intentos', () => {
    const result = calcularAnalisisTemporal([
      makeEntry({ created_at: '2026-04-18T10:00:00Z' }),
      makeEntry({ created_at: '2026-04-19T10:00:00Z' }),
      makeEntry({ created_at: '2026-04-21T10:00:00Z' }),
    ])
    expect(result).not.toBeNull()
    expect(result!.sesionesUnicas).toBe(3)
    expect(result!.diasEstudiando).toBe(3) // 18 → 21
    expect(result!.intervalos).toEqual([1, 2])
    expect(result!.frecuenciaEstudio).toBe('3 intentos en 3 días')
  })

  it('cuenta días únicos correctamente con repetidos', () => {
    const result = calcularAnalisisTemporal([
      makeEntry({ created_at: '2026-04-20T08:00:00Z' }),
      makeEntry({ created_at: '2026-04-20T14:00:00Z' }),
      makeEntry({ created_at: '2026-04-21T10:00:00Z' }),
    ])
    expect(result).not.toBeNull()
    expect(result!.sesionesUnicas).toBe(2) // 2 días distintos
  })
})

// ============================================
// calcularPatronesRendimiento
// ============================================
describe('calcularPatronesRendimiento', () => {
  it('devuelve null con historial vacío', () => {
    expect(calcularPatronesRendimiento([])).toBeNull()
  })

  it('tendencia estable con < 3 intentos', () => {
    const result = calcularPatronesRendimiento([
      makeEntry({ is_correct: true, time_spent_seconds: 30 }),
      makeEntry({ is_correct: false, time_spent_seconds: 25 }),
    ])
    expect(result!.tendencia).toBe('estable')
  })

  it('detecta tendencia mejorando', () => {
    const history = [
      makeEntry({ is_correct: false, time_spent_seconds: 30 }),
      makeEntry({ is_correct: false, time_spent_seconds: 30 }),
      makeEntry({ is_correct: false, time_spent_seconds: 30 }),
      makeEntry({ is_correct: true, time_spent_seconds: 30 }),
      makeEntry({ is_correct: true, time_spent_seconds: 30 }),
      makeEntry({ is_correct: true, time_spent_seconds: 30 }),
    ]
    expect(calcularPatronesRendimiento(history)!.tendencia).toBe('mejorando')
  })

  it('detecta tendencia empeorando', () => {
    const history = [
      makeEntry({ is_correct: true, time_spent_seconds: 30 }),
      makeEntry({ is_correct: true, time_spent_seconds: 30 }),
      makeEntry({ is_correct: true, time_spent_seconds: 30 }),
      makeEntry({ is_correct: false, time_spent_seconds: 30 }),
      makeEntry({ is_correct: false, time_spent_seconds: 30 }),
      makeEntry({ is_correct: false, time_spent_seconds: 30 }),
    ]
    expect(calcularPatronesRendimiento(history)!.tendencia).toBe('empeorando')
  })

  it('clasifica velocidad correctamente', () => {
    // Promedio = 30, último = 15 → muy_rapida (< 0.7 * 30 = 21)
    const fast = [
      makeEntry({ time_spent_seconds: 30 }),
      makeEntry({ time_spent_seconds: 30 }),
      makeEntry({ time_spent_seconds: 15 }),
    ]
    expect(calcularPatronesRendimiento(fast)!.velocidadActual).toBe('muy_rapida')

    // Promedio = 30, último = 50 → lenta (> 1.3 * 30 = 39)
    const slow = [
      makeEntry({ time_spent_seconds: 30 }),
      makeEntry({ time_spent_seconds: 30 }),
      makeEntry({ time_spent_seconds: 50 }),
    ]
    expect(calcularPatronesRendimiento(slow)!.velocidadActual).toBe('lenta')
  })
})

// ============================================
// calcularEstadisticasAvanzadas
// ============================================
describe('calcularEstadisticasAvanzadas', () => {
  it('devuelve null con historial vacío', () => {
    expect(calcularEstadisticasAvanzadas([])).toBeNull()
  })

  it('calcula efectividad por sesión', () => {
    const history = [
      makeEntry({ is_correct: true, test_session_id: 's1', psychometric_test_sessions: { session_type: 'psychometric' } }),
      makeEntry({ is_correct: false, test_session_id: 's1', psychometric_test_sessions: { session_type: 'psychometric' } }),
      makeEntry({ is_correct: true, test_session_id: 's2', psychometric_test_sessions: { session_type: 'random' } }),
    ]
    const result = calcularEstadisticasAvanzadas(history)!
    expect(result.efectividadPorSesion.psychometric).toBe(50)
    expect(result.efectividadPorSesion.random).toBe(100)
    expect(result.sesionesUnicas).toBe(2)
  })

  it('calcula rachas dentro de estadísticas', () => {
    const history = [
      makeEntry({ is_correct: true }),
      makeEntry({ is_correct: true }),
      makeEntry({ is_correct: false }),
      makeEntry({ is_correct: false }),
      makeEntry({ is_correct: false }),
    ]
    const result = calcularEstadisticasAvanzadas(history)!
    expect(result.rachaMaximaCorrecta).toBe(2)
    expect(result.rachaMaximaIncorrecta).toBe(3)
  })
})

// ============================================
// calculateCompleteEvolution
// ============================================
describe('calculateCompleteEvolution', () => {
  it('primera_vez con historial vacío', () => {
    const result = calculateCompleteEvolution([], CURRENT_RESULT)
    expect(result.tipoEvolucion).toBe('primera_vez')
    // CONTRATO (04/06): totalIntentos incluye el intento actual → 0 previos + 1 = 1.
    expect(result.totalIntentos).toBe(1)
    expect(result.tasaAciertos).toBe(100) // 1/1 (el actual es correcto)
    expect(result.color).toBe('blue')
    expect(result.mensaje).toContain('Primera vez')
  })

  // ============================================================================
  // CONTRATO: previousHistory contiene SOLO los intentos previos al actual.
  // El intento actual viene en `current`, no está en `previousHistory`.
  // length=0 ⇒ primera vez. length=1 ⇒ segunda vez. length=N ⇒ (N+1).ª vez.
  // (Bug histórico: hasta 05/05/2026, length=1 se trataba como primera vez.
  //  Se corrigió y se documenta este contrato. Caso real: feedback c294a029
  //  de Nila, captura mostraba "Primera vez" + "Primer intento: hace 1 mes".)
  // ============================================================================

  it('2.ª visita acertando previo + acertando current → consistente_correcto (no primera_vez)', () => {
    const result = calculateCompleteEvolution(
      [makeEntry({ is_correct: true })],
      { isCorrect: true, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('consistente_correcto')
    expect(result.totalIntentos).toBe(2)  // 1 previo + el actual (contrato 04/06)
    expect(result.tasaAciertos).toBe(100)
    expect(result.mensaje).toContain('Dominas')
    expect(result.mensaje).toContain('2/2')  // visible al usuario: 2 aciertos en 2 intentos (incl. actual)
  })

  it('2.ª visita: previo fallo + current acierto → mejora', () => {
    const result = calculateCompleteEvolution(
      [makeEntry({ is_correct: false })],
      { isCorrect: true, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('mejora')
    expect(result.color).toBe('green')
    expect(result.mensaje).toContain('Antes fallaste')
  })

  it('2.ª visita: previo acierto + current fallo → retroceso', () => {
    const result = calculateCompleteEvolution(
      [makeEntry({ is_correct: true })],
      { isCorrect: false, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('retroceso')
    expect(result.color).toBe('orange')
    expect(result.mensaje).toContain('Antes acertaste')
  })

  it('2.ª visita: previo fallo + current fallo → consistente_incorrecto', () => {
    const result = calculateCompleteEvolution(
      [makeEntry({ is_correct: false })],
      { isCorrect: false, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('consistente_incorrecto')
    expect(result.color).toBe('red')
    expect(result.mensaje).toContain('te cuesta')
    expect(result.mensaje).toContain('0/2')  // 0 aciertos en 2 intentos totales
  })

  it('3.ª+ visita con mejora: previos [fallo, fallo] + current acierto → mejora (compara último previo vs current)', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: false }),
        makeEntry({ is_correct: false }),
      ],
      { isCorrect: true, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('mejora')
    expect(result.color).toBe('green')
  })

  it('3.ª+ visita con retroceso: previos [acierto, acierto] + current fallo → retroceso', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: true }),
        makeEntry({ is_correct: true }),
      ],
      { isCorrect: false, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('retroceso')
    expect(result.color).toBe('orange')
  })

  it('3.ª+ visita consistente correcta: previos [acierto, acierto] + current acierto → consistente_correcto (3/3)', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: true }),
        makeEntry({ is_correct: true }),
      ],
      { isCorrect: true, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('consistente_correcto')
    expect(result.color).toBe('green')
    expect(result.mensaje).toContain('Dominas')
    expect(result.mensaje).toContain('3/3')
  })

  it('3.ª+ visita consistente incorrecta: previos [fallo, fallo] + current fallo → consistente_incorrecto (0/3)', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: false }),
        makeEntry({ is_correct: false }),
      ],
      { isCorrect: false, timeSpent: 0, answer: 0 },
    )
    expect(result.tipoEvolucion).toBe('consistente_incorrecto')
    expect(result.color).toBe('red')
    expect(result.mensaje).toContain('te cuesta')
    expect(result.mensaje).toContain('0/3')
  })

  it('tasa de aciertos correcta con historial mixto', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: true }),
        makeEntry({ is_correct: false }),
        makeEntry({ is_correct: true }),
        makeEntry({ is_correct: true }),
      ],
      CURRENT_RESULT,
    )
    expect(result.totalIntentos).toBe(5)  // 4 previos + el actual (contrato 04/06)
    expect(result.tasaAciertos).toBe(80) // 4/5 (incluye el actual, correcto)
  })

  // ============================================================================
  // SIMULACIONES DE REGRESIÓN — basadas en casos reales de feedback
  // ============================================================================

  describe('Regresión: caso real Nila (feedback c294a029, 04/05/2026)', () => {
    // Captura del usuario:
    //  - "Primera vez que ves esta pregunta psicotécnica" + "Frecuencia: Primera vez"
    //  - PERO "Primer intento: Hace 1 meses" → contradicción visible
    // Datos en BD verificados:
    //  - q:716beef4 → 1 intento previo el 27-mar (acierto), respondida de nuevo el 04-may (acierto)
    //  - previousHistory.length === 1, current.isCorrect === true
    // Comportamiento esperado tras el fix: NO "primera_vez" → consistente_correcto.

    it('simula el caso exacto de Nila: 1 previo acierto (27-mar) + current acierto (04-may) → consistente_correcto', () => {
      const previousHistory = [
        makeEntry({
          is_correct: true,
          created_at: '2026-03-27T17:47:00Z',
          test_session_id: 'sess-marzo',
        }),
      ]
      const current = { isCorrect: true, timeSpent: 17, answer: 0 }

      const result = calculateCompleteEvolution(previousHistory, current)

      expect(result.tipoEvolucion).not.toBe('primera_vez')
      expect(result.tipoEvolucion).toBe('consistente_correcto')
      expect(result.mensaje).not.toContain('Primera vez')
      expect(result.mensaje).toContain('Dominas')
      expect(result.color).toBe('green')

      // El bloque temporal debe mostrarse (no null) y reflejar correctamente el historial
      expect(result.analisisTemporal).not.toBeNull()
      expect(result.analisisTemporal!.frecuenciaEstudio).toBe('2 intentos en 2 días')
      expect(result.analisisTemporal!.frecuenciaEstudio).not.toBe('Primera vez')
      expect(result.analisisTemporal!.sesionesUnicas).toBe(2) // 27-mar + hoy (incluye el actual)
    })

    it('CONTRATO: previousHistory NUNCA debe incluir el intento actual (asíncrono via cola offline)', () => {
      // Si alguien refactoriza el flujo a guardado síncrono y mete el actual en previousHistory,
      // este test no detecta el cambio (lo haría un test de integración). Pero documenta el contrato:
      // el componente asume que el actual NO está en la lista que recibe.
      const result = calculateCompleteEvolution([], { isCorrect: true, timeSpent: 0, answer: 0 })
      expect(result.tipoEvolucion).toBe('primera_vez')
      expect(result.totalIntentos).toBe(1) // 0 previos + el actual (contrato 04/06)
    })

    it('simula caso "unas funcionan y otras no" (4 preguntas, solo 1 con bug histórico)', () => {
      // Nila reportó: "unas preguntas funcionan y otras no". Verificación:
      //  - q sin previos → "primera_vez" (correcto, siempre)
      //  - q con 1 previo → ANTES bug "primera_vez", AHORA correcto
      //  - q con 3+ previos → siempre correcto (no afectado)

      // Caso 1: pregunta nueva (0 previos)
      const r1 = calculateCompleteEvolution([], { isCorrect: true, timeSpent: 0, answer: 0 })
      expect(r1.tipoEvolucion).toBe('primera_vez')

      // Caso 2 (LA QUE TENÍA BUG): pregunta con 1 previo acierto
      const r2 = calculateCompleteEvolution(
        [makeEntry({ is_correct: true })],
        { isCorrect: true, timeSpent: 0, answer: 0 },
      )
      expect(r2.tipoEvolucion).toBe('consistente_correcto')

      // Caso 3: pregunta con 5 previos mixtos + acierto actual
      const r3 = calculateCompleteEvolution(
        [
          makeEntry({ is_correct: true }),
          makeEntry({ is_correct: false }),
          makeEntry({ is_correct: true }),
          makeEntry({ is_correct: true }),
          makeEntry({ is_correct: false }),  // último previo: fallo
        ],
        { isCorrect: true, timeSpent: 0, answer: 0 },
      )
      expect(r3.tipoEvolucion).toBe('mejora') // último previo fallo → current acierto
    })
  })

  it('incluye todos los campos de análisis', () => {
    const history = [
      makeEntry({ is_correct: true, time_spent_seconds: 40, created_at: '2026-04-18T10:00:00Z', test_session_id: 's1' }),
      makeEntry({ is_correct: false, time_spent_seconds: 20, created_at: '2026-04-19T10:00:00Z', test_session_id: 's2' }),
      makeEntry({ is_correct: true, time_spent_seconds: 15, created_at: '2026-04-20T10:00:00Z', test_session_id: 's3' }),
    ]
    const result = calculateCompleteEvolution(history, CURRENT_RESULT)

    expect(result.mejorasTiempo).not.toBeNull()
    expect(result.analisisTemporal).not.toBeNull()
    expect(result.patronesRendimiento).not.toBeNull()
    expect(result.estadisticasAvanzadas).not.toBeNull()
    expect(result.historialCompleto).toHaveLength(4) // 3 previos + el actual
  })
})

// ============================================
// SOURCE: file is .tsx
// ============================================
describe('PsychometricQuestionEvolution — source file', () => {
  const fs = require('fs')
  const path = require('path')

  it('existe como .tsx (no .js)', () => {
    const tsxPath = path.join(__dirname, '../../components/PsychometricQuestionEvolution.tsx')
    const jsPath = path.join(__dirname, '../../components/PsychometricQuestionEvolution.js')
    expect(fs.existsSync(tsxPath)).toBe(true)
    expect(fs.existsSync(jsPath)).toBe(false)
  })

  it('exporta las funciones de lógica para testing', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '../../components/PsychometricQuestionEvolution.tsx'),
      'utf-8',
    )
    expect(content).toMatch(/export function calcularRachaMaxima/)
    expect(content).toMatch(/export function calcularMejoraTiempo/)
    expect(content).toMatch(/export function calculateCompleteEvolution/)
  })

  it('no usa !inner JOIN (bug RLS)', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '../../components/PsychometricQuestionEvolution.tsx'),
      'utf-8',
    )
    expect(content).not.toMatch(/!inner/)
  })

  it('obtiene el historial vía endpoint Drizzle (no PostgREST), filtrado por user_id server-side', () => {
    // Fase C1: el componente ya NO consulta la BD directo. Llama al endpoint
    // /api/v2/psychometric-evolution/history, que filtra WHERE user_id = <token>
    // (el aislamiento se prueba en __tests__/api/v2/psychometricEvolutionHistory).
    const content = fs.readFileSync(
      path.join(__dirname, '../../components/PsychometricQuestionEvolution.tsx'),
      'utf-8',
    )
    expect(content).toMatch(/\/api\/v2\/psychometric-evolution\/history/)
    expect(content).not.toMatch(/supabase/)
  })
})
