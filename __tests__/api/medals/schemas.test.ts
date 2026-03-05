/**
 * Tests para schemas de medallas
 */
import {
  RANKING_MEDALS,
  userMedalSchema,
  checkMedalsRequestSchema,
  getMedalsRequestSchema,
  getMedalsResponseSchema,
  safeParseGetMedalsRequest,
  safeParseCheckMedalsRequest,
} from '../../../lib/api/medals/schemas'

describe('RANKING_MEDALS', () => {
  test('tiene 8 medallas definidas', () => {
    expect(Object.keys(RANKING_MEDALS)).toHaveLength(8)
  })

  test('cada medalla tiene id, title, description, category, emailTemplate', () => {
    for (const [key, medal] of Object.entries(RANKING_MEDALS)) {
      expect(medal.id).toBeDefined()
      expect(typeof medal.id).toBe('string')
      expect(medal.title).toBeDefined()
      expect(typeof medal.title).toBe('string')
      expect(medal.description).toBeDefined()
      expect(typeof medal.description).toBe('string')
      expect(medal.category).toBeDefined()
      expect(typeof medal.category).toBe('string')
      expect(medal.emailTemplate).toBeDefined()
      expect(typeof medal.emailTemplate).toBe('string')
    }
  })

  test('IDs unicos entre todas las medallas', () => {
    const ids = Object.values(RANKING_MEDALS).map(m => m.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  test('contiene medallas de primer lugar para cada periodo', () => {
    expect(RANKING_MEDALS.FIRST_PLACE_TODAY).toBeDefined()
    expect(RANKING_MEDALS.FIRST_PLACE_WEEK).toBeDefined()
    expect(RANKING_MEDALS.FIRST_PLACE_MONTH).toBeDefined()
  })

  test('contiene medallas de podio para cada periodo', () => {
    expect(RANKING_MEDALS.TOP_3_TODAY).toBeDefined()
    expect(RANKING_MEDALS.TOP_3_WEEK).toBeDefined()
    expect(RANKING_MEDALS.TOP_3_MONTH).toBeDefined()
  })

  test('contiene medallas de rendimiento y volumen', () => {
    expect(RANKING_MEDALS.HIGH_ACCURACY).toBeDefined()
    expect(RANKING_MEDALS.VOLUME_LEADER).toBeDefined()
  })
})

describe('userMedalSchema', () => {
  const validMedal = {
    id: 'first_place_today',
    title: 'Lider del Dia',
    description: 'Primer lugar en el ranking diario',
    category: 'Ranking Diario',
    emailTemplate: 'daily_champion',
    unlocked: true,
    progress: 'Posicion #1 de 10 usuarios',
    unlockedAt: '2026-03-05T14:30:00.000Z',
    rank: 1,
    period: 'today',
    stats: {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      totalQuestions: 50,
      correctAnswers: 45,
      accuracy: 90,
    },
  }

  test('valida medalla completa', () => {
    const result = userMedalSchema.safeParse(validMedal)
    expect(result.success).toBe(true)
  })

  test('rechaza medalla sin id', () => {
    const { id, ...noId } = validMedal
    const result = userMedalSchema.safeParse(noId)
    expect(result.success).toBe(false)
  })

  test('rechaza medalla sin rank', () => {
    const { rank, ...noRank } = validMedal
    const result = userMedalSchema.safeParse(noRank)
    expect(result.success).toBe(false)
  })

  test('stats puede ser null', () => {
    const result = userMedalSchema.safeParse({ ...validMedal, stats: null })
    expect(result.success).toBe(true)
  })
})

describe('checkMedalsRequestSchema', () => {
  test('userId UUID valido', () => {
    const result = checkMedalsRequestSchema.safeParse({
      userId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  test('userId faltante rechazado', () => {
    const result = checkMedalsRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  test('userId no-UUID rechazado', () => {
    const result = checkMedalsRequestSchema.safeParse({ userId: 'abc' })
    expect(result.success).toBe(false)
  })
})

describe('getMedalsResponseSchema', () => {
  test('respuesta exitosa con medallas', () => {
    const result = getMedalsResponseSchema.safeParse({
      success: true,
      medals: [],
    })
    expect(result.success).toBe(true)
  })

  test('respuesta fallida con error', () => {
    const result = getMedalsResponseSchema.safeParse({
      success: false,
      error: 'algo salio mal',
    })
    expect(result.success).toBe(true)
  })
})

describe('validators', () => {
  test('safeParseGetMedalsRequest valido', () => {
    const result = safeParseGetMedalsRequest({ userId: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })

  test('safeParseCheckMedalsRequest valido', () => {
    const result = safeParseCheckMedalsRequest({ userId: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })
})
