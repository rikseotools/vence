/**
 * @jest-environment node
 */
// T-319, paso 1 del diseño decidido ("degradar la respuesta"): `get_personalized_recommendations`
// es la ÚNICA de las 6 consultas del endpoint que no se migró a user_question_history_v2, y en
// frío llega a tardar 9-19 s en usuarios pesados. Antes de este cambio, esa lentitud se llevaba
// por delante TODO el endpoint (las otras 5 consultas resuelven en milisegundos, pero el timeout
// de 12 s envolvía el conjunto entero) — el 4,6% de fallos medido en la ficha. Lo que fija este
// test: un timeout SOLO en recomendaciones no tumba la respuesta, la deja vacía, deja rastro
// observable distinguible de un fallo genérico, y no hace esperar al usuario el tiempo completo
// de la consulta lenta.

const mockEmitidos: Array<Record<string, unknown>> = []

jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (e: Record<string, unknown>) => { mockEmitidos.push(e) },
}))
jest.mock('@/lib/observability/instanceId', () => ({ INSTANCE_ID: 'test-instance' }))

const mockLento = (ms: number, valor: unknown) =>
  new Promise((res) => setTimeout(() => res(valor), ms))

// `getRecommendations` es la única función que va por `db.execute` en el camino v2 (las otras 5
// van por queriesV2, mockeadas aparte). Aquí controlamos cuánto tarda esa query concreta.
let mockRecomendacionesMs = 0

jest.mock('@/db/client', () => ({
  getDb: () => ({ execute: async () => mockLento(mockRecomendacionesMs, []) }),
  getReadDb: () => (jest.requireMock('@/db/client') as { getDb: () => unknown }).getDb(),
}))

jest.mock('@/lib/api/difficulty-insights/queriesV2', () => ({
  getMetricsV2: () => mockLento(5, { totalQuestionsAttempted: 0, questionsMastered: 0, questionsStruggling: 0, avgPersonalDifficulty: 0, accuracyTrend: 'stable' }),
  getPersonalBreakdownV2: () => mockLento(5, { easy: 0, medium: 0, hard: 0, extreme: 0, total: 0 }),
  getStrugglingQuestionsV2: () => mockLento(5, []),
  getMasteredQuestionsV2: () => mockLento(5, []),
  getProgressTrendsV2: () => mockLento(5, { improving: 0, declining: 0, stable: 0, total: 0 }),
}))

import { getDifficultyInsights } from '@/lib/api/difficulty-insights/queries'

const UID = '8ec9fbe3-e48a-4d58-85f0-8b6de991027f'
const ENV_TIMEOUT_MS = 'DIFFICULTY_INSIGHTS_RECS_TIMEOUT_MS'

describe('degradación de recomendaciones (T-319)', () => {
  const original = process.env[ENV_TIMEOUT_MS]

  beforeEach(() => { mockEmitidos.length = 0; mockRecomendacionesMs = 0 })
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_TIMEOUT_MS]
    else process.env[ENV_TIMEOUT_MS] = original
  })

  it('una recomendación LENTA (por encima del techo) NO tumba el resto del endpoint', async () => {
    process.env[ENV_TIMEOUT_MS] = '80' // techo bajo para no esperar segundos reales en el test
    mockRecomendacionesMs = 500 // muy por encima del techo — simula el caso de 9-19 s en frío

    const r = await getDifficultyInsights(UID)

    expect(r.success).toBe(true)
    expect(r.data?.recommendations).toEqual([])
    // Las otras 5 secciones siguen presentes: el degradado es SOLO de esta pestaña.
    expect(r.data?.metrics).toBeDefined()
    expect(r.data?.progressTrends).toBeDefined()
  })

  it('la respuesta no espera la duración completa de la consulta lenta', async () => {
    process.env[ENV_TIMEOUT_MS] = '80'
    mockRecomendacionesMs = 500

    const t0 = Date.now()
    await getDifficultyInsights(UID)
    const ms = Date.now() - t0

    // Cota generosa: si el fix no funcionara, esto tardaría >= 500 ms (la duración real de la
    // query simulada). Con el techo a 80 ms, la respuesta debe llegar bien por debajo de eso.
    expect(ms).toBeLessThan(400)
  })

  it('deja rastro DISTINGUIBLE de un fallo genérico: evento propio con el timeout aplicado', async () => {
    process.env[ENV_TIMEOUT_MS] = '80'
    mockRecomendacionesMs = 500

    await getDifficultyInsights(UID)

    const degradado = mockEmitidos.find(e => e.eventType === 'difficulty_insights_recomendaciones_degradadas')
    expect(degradado).toBeDefined()
    expect((degradado?.metadata as Record<string, unknown>).timeoutMs).toBe(80)
    expect((degradado?.metadata as Record<string, unknown>).userId).toBe(UID)
  })

  it('una recomendación RÁPIDA (por debajo del techo) no se degrada y no emite el evento', async () => {
    process.env[ENV_TIMEOUT_MS] = '80'
    mockRecomendacionesMs = 5

    const r = await getDifficultyInsights(UID)

    expect(r.success).toBe(true)
    expect(mockEmitidos.find(e => e.eventType === 'difficulty_insights_recomendaciones_degradadas')).toBeUndefined()
  })

  it('sin la variable de entorno, el techo por defecto es 6000 ms (no cambia el comportamiento en producción sin configurar nada)', async () => {
    delete process.env[ENV_TIMEOUT_MS]
    mockRecomendacionesMs = 5 // rápida a propósito: no queremos un test de varios segundos

    const r = await getDifficultyInsights(UID)

    expect(r.success).toBe(true)
    expect(mockEmitidos.find(e => e.eventType === 'difficulty_insights_recomendaciones_degradadas')).toBeUndefined()
  })
})
