/**
 * Tests para schemas de validacion del ranking
 */
import {
  getRankingRequestSchema,
  rankingEntrySchema,
  userPositionSchema,
  getRankingResponseSchema,
  safeParseGetRankingRequest,
} from '../../../lib/api/ranking/schemas'

describe('getRankingRequestSchema', () => {
  test('timeFilter "today" es valido', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today' })
    expect(result.success).toBe(true)
  })

  test('timeFilter "yesterday" es valido', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'yesterday' })
    expect(result.success).toBe(true)
  })

  test('timeFilter "week" es valido', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'week' })
    expect(result.success).toBe(true)
  })

  test('timeFilter "month" es valido', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'month' })
    expect(result.success).toBe(true)
  })

  test('timeFilter "invalid" es rechazado', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'invalid' })
    expect(result.success).toBe(false)
  })

  test('timeFilter undefined es rechazado', () => {
    const result = getRankingRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  test('minQuestions numero valido', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today', minQuestions: 10 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.minQuestions).toBe(10)
  })

  test('minQuestions 0 es rechazado (min 1)', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today', minQuestions: 0 })
    expect(result.success).toBe(false)
  })

  test('minQuestions negativo es rechazado', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today', minQuestions: -1 })
    expect(result.success).toBe(false)
  })

  test('minQuestions default es 5', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.minQuestions).toBe(5)
  })

  test('limit numero valido', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today', limit: 50 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(50)
  })

  test('limit 0 es rechazado (min 1)', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today', limit: 0 })
    expect(result.success).toBe(false)
  })

  test('limit default es 100', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(100)
  })

  test('userId UUID valido', () => {
    const result = getRankingRequestSchema.safeParse({
      timeFilter: 'today',
      userId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  test('userId string invalido es rechazado', () => {
    const result = getRankingRequestSchema.safeParse({
      timeFilter: 'today',
      userId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  test('userId es opcional', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.userId).toBeUndefined()
  })
})

describe('rankingEntrySchema', () => {
  test('entrada valida con todos los campos', () => {
    const result = rankingEntrySchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      totalQuestions: 50,
      correctAnswers: 40,
      accuracy: 80,
      rank: 1,
    })
    expect(result.success).toBe(true)
  })

  test('rechaza entrada sin userId', () => {
    const result = rankingEntrySchema.safeParse({
      totalQuestions: 50,
      correctAnswers: 40,
      accuracy: 80,
      rank: 1,
    })
    expect(result.success).toBe(false)
  })

  test('rechaza accuracy > 100', () => {
    const result = rankingEntrySchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      totalQuestions: 50,
      correctAnswers: 40,
      accuracy: 101,
      rank: 1,
    })
    expect(result.success).toBe(false)
  })

  test('rechaza rank 0', () => {
    const result = rankingEntrySchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      totalQuestions: 50,
      correctAnswers: 40,
      accuracy: 80,
      rank: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('userPositionSchema', () => {
  test('posicion valida', () => {
    const result = userPositionSchema.safeParse({
      rank: 3,
      totalQuestions: 20,
      correctAnswers: 16,
      accuracy: 80,
      totalUsers: 10,
    })
    expect(result.success).toBe(true)
  })

  test('rank debe ser >= 1', () => {
    const result = userPositionSchema.safeParse({
      rank: 0,
      totalQuestions: 20,
      correctAnswers: 16,
      accuracy: 80,
      totalUsers: 10,
    })
    expect(result.success).toBe(false)
  })

  test('totalUsers debe ser >= 1', () => {
    const result = userPositionSchema.safeParse({
      rank: 1,
      totalQuestions: 20,
      correctAnswers: 16,
      accuracy: 80,
      totalUsers: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('getRankingResponseSchema', () => {
  test('respuesta exitosa con ranking', () => {
    const result = getRankingResponseSchema.safeParse({
      success: true,
      ranking: [
        {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          totalQuestions: 50,
          correctAnswers: 40,
          accuracy: 80,
          rank: 1,
        },
      ],
      generatedAt: new Date().toISOString(),
    })
    expect(result.success).toBe(true)
  })

  test('respuesta fallida con error', () => {
    const result = getRankingResponseSchema.safeParse({
      success: false,
      error: 'Error de conexion',
    })
    expect(result.success).toBe(true)
  })

  test('respuesta exitosa con userPosition', () => {
    const result = getRankingResponseSchema.safeParse({
      success: true,
      ranking: [],
      userPosition: {
        rank: 5,
        totalQuestions: 30,
        correctAnswers: 24,
        accuracy: 80,
        totalUsers: 20,
      },
      generatedAt: new Date().toISOString(),
    })
    expect(result.success).toBe(true)
  })
})

describe('safeParseGetRankingRequest', () => {
  test('wrapper funciona correctamente para datos validos', () => {
    const result = safeParseGetRankingRequest({ timeFilter: 'today' })
    expect(result.success).toBe(true)
  })

  test('wrapper funciona correctamente para datos invalidos', () => {
    const result = safeParseGetRankingRequest({ timeFilter: 'xxx' })
    expect(result.success).toBe(false)
  })
})
