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

  it('calcula correctamente con un solo intento', () => {
    const result = calcularAnalisisTemporal([
      makeEntry({ created_at: '2026-04-20T10:00:00Z' }),
    ])
    expect(result).not.toBeNull()
    expect(result!.sesionesUnicas).toBe(1)
    expect(result!.frecuenciaEstudio).toBe('Primera vez')
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
    expect(result.totalIntentos).toBe(0)
    expect(result.tasaAciertos).toBe(0)
    expect(result.color).toBe('blue')
    expect(result.mensaje).toContain('Primera vez')
  })

  it('primera_vez con 1 intento', () => {
    const result = calculateCompleteEvolution(
      [makeEntry({ is_correct: true })],
      CURRENT_RESULT,
    )
    expect(result.tipoEvolucion).toBe('primera_vez')
    expect(result.totalIntentos).toBe(1)
    expect(result.tasaAciertos).toBe(100)
  })

  it('mejora: penúltimo incorrecto, último correcto', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: false }),
        makeEntry({ is_correct: true }),
      ],
      CURRENT_RESULT,
    )
    expect(result.tipoEvolucion).toBe('mejora')
    expect(result.color).toBe('green')
  })

  it('retroceso: penúltimo correcto, último incorrecto', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: true }),
        makeEntry({ is_correct: false }),
      ],
      CURRENT_RESULT,
    )
    expect(result.tipoEvolucion).toBe('retroceso')
    expect(result.color).toBe('orange')
  })

  it('consistente_correcto: ambos últimos correctos', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: true }),
        makeEntry({ is_correct: true }),
      ],
      CURRENT_RESULT,
    )
    expect(result.tipoEvolucion).toBe('consistente_correcto')
    expect(result.color).toBe('green')
    expect(result.mensaje).toContain('Dominas')
  })

  it('consistente_incorrecto: ambos últimos incorrectos', () => {
    const result = calculateCompleteEvolution(
      [
        makeEntry({ is_correct: false }),
        makeEntry({ is_correct: false }),
      ],
      CURRENT_RESULT,
    )
    expect(result.tipoEvolucion).toBe('consistente_incorrecto')
    expect(result.color).toBe('red')
    expect(result.mensaje).toContain('te cuesta')
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
    expect(result.totalIntentos).toBe(4)
    expect(result.tasaAciertos).toBe(75) // 3/4
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
    expect(result.historialCompleto).toHaveLength(3)
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

  it('filtra por user_id directamente (no via JOIN)', () => {
    const content = fs.readFileSync(
      path.join(__dirname, '../../components/PsychometricQuestionEvolution.tsx'),
      'utf-8',
    )
    expect(content).toMatch(/\.eq\('user_id', userId\)/)
  })
})
