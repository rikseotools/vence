/**
 * Tests para schemas de validacion del ranking
 */
import {
  getRankingRequestSchema,
  rankingEntrySchema,
  userPositionSchema,
  getRankingResponseSchema,
  safeParseGetRankingRequest,
  avatarSchema,
  getStreakRankingRequestSchema,
  streakEntrySchema,
  getStreakRankingResponseSchema,
  safeParseGetStreakRankingRequest,
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

  test('limit default es 50', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(50)
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

  test('offset numero valido', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today', offset: 50 })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.offset).toBe(50)
  })

  test('offset negativo es rechazado', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today', offset: -1 })
    expect(result.success).toBe(false)
  })

  test('offset default es 0', () => {
    const result = getRankingRequestSchema.safeParse({ timeFilter: 'today' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.offset).toBe(0)
  })
})

describe('avatarSchema', () => {
  test('avatar automatico valido', () => {
    const result = avatarSchema.safeParse({
      type: 'automatic',
      emoji: '🦊',
      profile: 'fox',
    })
    expect(result.success).toBe(true)
  })

  test('avatar predefinido valido', () => {
    const result = avatarSchema.safeParse({
      type: 'predefined',
      emoji: '👨‍💻',
      color: 'from-blue-500 to-green-500',
    })
    expect(result.success).toBe(true)
  })

  test('avatar uploaded valido', () => {
    const result = avatarSchema.safeParse({
      type: 'uploaded',
      url: 'https://example.com/avatar.jpg',
    })
    expect(result.success).toBe(true)
  })

  test('avatar null es valido', () => {
    const result = avatarSchema.safeParse(null)
    expect(result.success).toBe(true)
  })

  test('tipo invalido es rechazado', () => {
    const result = avatarSchema.safeParse({ type: 'invalid' })
    expect(result.success).toBe(false)
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
      name: 'Test User',
      ciudad: 'Madrid',
      avatar: null,
    })
    expect(result.success).toBe(true)
  })

  test('rechaza entrada sin userId', () => {
    const result = rankingEntrySchema.safeParse({
      totalQuestions: 50,
      correctAnswers: 40,
      accuracy: 80,
      rank: 1,
      name: 'Test',
      ciudad: null,
      avatar: null,
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
      name: 'Test',
      ciudad: null,
      avatar: null,
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
      name: 'Test',
      ciudad: null,
      avatar: null,
    })
    expect(result.success).toBe(false)
  })

  test('entrada con avatar completo', () => {
    const result = rankingEntrySchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      totalQuestions: 50,
      correctAnswers: 40,
      accuracy: 80,
      rank: 1,
      name: 'Test User',
      ciudad: 'Barcelona',
      avatar: { type: 'automatic', emoji: '🦊' },
    })
    expect(result.success).toBe(true)
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
  test('respuesta exitosa con ranking y hasMore', () => {
    const result = getRankingResponseSchema.safeParse({
      success: true,
      ranking: [
        {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          totalQuestions: 50,
          correctAnswers: 40,
          accuracy: 80,
          rank: 1,
          name: 'User',
          ciudad: null,
          avatar: null,
        },
      ],
      hasMore: true,
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
      hasMore: false,
      generatedAt: new Date().toISOString(),
    })
    expect(result.success).toBe(true)
  })
})

describe('getStreakRankingRequestSchema', () => {
  test('timeFilter "week" es valido', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'week' })
    expect(result.success).toBe(true)
  })

  test('timeFilter "month" es valido', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'month' })
    expect(result.success).toBe(true)
  })

  test('timeFilter "all" es valido', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'all' })
    expect(result.success).toBe(true)
  })

  test('timeFilter "today" es rechazado', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'today' })
    expect(result.success).toBe(false)
  })

  test('category default es "all"', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'week' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.category).toBe('all')
  })

  test('category "principiantes" es valido', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'week', category: 'principiantes' })
    expect(result.success).toBe(true)
  })

  test('category "veteranos" es valido', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'week', category: 'veteranos' })
    expect(result.success).toBe(true)
  })

  test('offset y limit validos', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'week', offset: 10, limit: 25 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.offset).toBe(10)
      expect(result.data.limit).toBe(25)
    }
  })

  test('defaults: offset 0, limit 50', () => {
    const result = getStreakRankingRequestSchema.safeParse({ timeFilter: 'week' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.offset).toBe(0)
      expect(result.data.limit).toBe(50)
    }
  })
})

describe('streakEntrySchema', () => {
  test('entrada valida', () => {
    const result = streakEntrySchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      streak: 5,
      rank: 1,
      name: 'Test User',
      ciudad: null,
      avatar: null,
      isNovato: false,
    })
    expect(result.success).toBe(true)
  })

  test('requiere isNovato', () => {
    const result = streakEntrySchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
      streak: 5,
      rank: 1,
      name: 'Test',
      ciudad: null,
      avatar: null,
    })
    expect(result.success).toBe(false)
  })
})

describe('getStreakRankingResponseSchema', () => {
  test('respuesta exitosa con streaks y hasMore', () => {
    const result = getStreakRankingResponseSchema.safeParse({
      success: true,
      streaks: [
        {
          userId: '550e8400-e29b-41d4-a716-446655440000',
          streak: 7,
          rank: 1,
          name: 'User',
          ciudad: 'Madrid',
          avatar: null,
          isNovato: true,
        },
      ],
      hasMore: false,
    })
    expect(result.success).toBe(true)
  })

  test('respuesta fallida', () => {
    const result = getStreakRankingResponseSchema.safeParse({
      success: false,
      error: 'Error',
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

describe('safeParseGetStreakRankingRequest', () => {
  test('wrapper funciona para datos validos', () => {
    const result = safeParseGetStreakRankingRequest({ timeFilter: 'week' })
    expect(result.success).toBe(true)
  })

  test('wrapper funciona para datos invalidos', () => {
    const result = safeParseGetStreakRankingRequest({ timeFilter: 'invalid' })
    expect(result.success).toBe(false)
  })
})
