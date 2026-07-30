/**
 * @jest-environment node
 */
// Integración del desglose por fases de `/api/v2/difficulty-insights` (T-319).
//
// Lo que fija: que la petición LENTA y —sobre todo— la que FALLA dejen constancia de en cuál de
// las 7 consultas se fue el tiempo. Ese era el hueco: el endpoint fallaba el 4,6% de sus peticiones
// y su evento de error solo guardaba `host`, `method` y `errorRef`, así que averiguar la causa
// exigió reconstruirla a mano contra producción.
//
// Se mockea la BD (no el núcleo de decisión, que es el real de producción).

const mockEmitidos: Array<Record<string, unknown>> = []

jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (e: Record<string, unknown>) => { mockEmitidos.push(e) },
}))
jest.mock('@/lib/observability/instanceId', () => ({ INSTANCE_ID: 'test-instance' }))

const mockLento = (ms: number, valor: unknown) =>
  new Promise((res) => setTimeout(() => res(valor), ms))

// `getRecommendations` es la única que va por `db.execute` — la que en producción lee los 5,6 GB
// de `test_questions`. Aquí se simula lenta para comprobar que el desglose la señala.
let mockRetraso = 0
let mockFalla = false

jest.mock('@/db/client', () => ({
  getDb: () => ({
    execute: async () => {
      if (mockFalla) {
        await mockLento(mockRetraso, null)
        throw new Error('statement timeout simulado')
      }
      return mockLento(mockRetraso, [])
    },
  }),
  getReadDb: () => (jest.requireMock('@/db/client') as { getDb: () => unknown }).getDb(),
}))

jest.mock('@/lib/api/difficulty-insights/queriesV2', () => ({
  getMetricsV2: () => mockFalla
    ? Promise.reject(new Error('v2 caída'))
    : mockLento(5, { totalQuestionsAttempted: 0, questionsMastered: 0, questionsStruggling: 0, avgPersonalDifficulty: 0, accuracyTrend: 'stable' }),
  getPersonalBreakdownV2: () => mockLento(5, { easy: 0, medium: 0, hard: 0, extreme: 0, total: 0 }),
  getStrugglingQuestionsV2: () => mockLento(5, []),
  getMasteredQuestionsV2: () => mockLento(5, []),
  getProgressTrendsV2: () => mockLento(5, { improving: 0, declining: 0, stable: 0, total: 0 }),
}))

import { getDifficultyInsights } from '@/lib/api/difficulty-insights/queries'

const UID = '8ec9fbe3-e48a-4d58-85f0-8b6de991027f'

describe('desglose por fases de difficulty-insights', () => {
  beforeEach(() => { mockEmitidos.length = 0; mockRetraso = 0; mockFalla = false })

  it('una petición RÁPIDA no emite nada (no se inunda la tabla de eventos)', async () => {
    const r = await getDifficultyInsights(UID)
    expect(r.success).toBe(true)
    expect(mockEmitidos).toHaveLength(0)
  })

  it('una petición LENTA señala qué consulta se llevó el tiempo', async () => {
    mockRetraso = 2_100 // por encima del umbral de 2 s
    const r = await getDifficultyInsights(UID)
    expect(r.success).toBe(true)
    expect(mockEmitidos).toHaveLength(1)
    const m = mockEmitidos[0].metadata as Record<string, unknown>
    expect(mockEmitidos[0].eventType).toBe('difficulty_insights_lento')
    expect(m.dominante).toBe('recomendaciones')
    expect(Number(m.recomendaciones)).toBeGreaterThanOrEqual(2_000)
    // 6 y no 7: `enriquecer` solo corre si hay preguntas que enriquecer, y aquí no las hay. Que
    // el número varíe según el camino ES la señal: dice hasta dónde llegó la petición.
    expect(m.consultasMedidas).toBe(6)
  }, 15_000)

  it('🎯 la petición que FALLA también deja desglose — era el caso ciego', async () => {
    // Sin esto, un rechazo de Promise.all se llevaba por delante la explicación justo en las
    // peticiones que importan: las que en 14 días acabaron en 503.
    mockRetraso = 2_100
    mockFalla = true
    const r = await getDifficultyInsights(UID)
    expect(r.success).toBe(false)
    expect(mockEmitidos).toHaveLength(1)
    const m = mockEmitidos[0].metadata as Record<string, unknown>
    // 6: la que revienta también deja su tiempo medido (eso es deliberado), y `enriquecer` no
    // llegó a correr. Que falten consultas ES la señal de hasta dónde llegó la petición.
    expect(Number(m.consultasMedidas)).toBe(6)
    expect(Number(m.totalMs)).toBeGreaterThan(0)
  }, 15_000)

  it('un fallo emitiendo observabilidad NUNCA tumba la respuesta del usuario', async () => {
    mockRetraso = 2_100
    const emit = jest.requireMock('@/lib/observability/emit') as { emitFireAndForget: unknown }
    const original = emit.emitFireAndForget
    emit.emitFireAndForget = () => { throw new Error('sink caído') }
    await expect(getDifficultyInsights(UID)).resolves.toMatchObject({ success: true })
    emit.emitFireAndForget = original
  }, 15_000)
})
