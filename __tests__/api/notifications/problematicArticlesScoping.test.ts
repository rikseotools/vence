// __tests__/api/notifications/problematicArticlesScoping.test.ts
// Regresión — FASE 2 y FASE 4 del refactor oposicion-scope.
//
// Valida que el helper getUserProblematicArticlesWeekly:
//  1. Devuelve [] si el scope (getAllowedLawIds) no tiene ninguna ley.
//  2. Mapea las filas Drizzle al shape esperado (equivalente a la RPC).
//
// El scoping real (inArray laws.id) se delega a Drizzle y se cubre por el
// snapshot de producción del endpoint + tests e2e en FASE 6.

jest.mock('@/db/client', () => ({
  getDb: jest.fn(),
}))

jest.mock('@/lib/api/oposicion-scope/queries', () => ({
  getAllowedLawIds: jest.fn(),
}))

import { getDb } from '@/db/client'
import { getAllowedLawIds } from '@/lib/api/oposicion-scope/queries'
import { getUserProblematicArticlesWeekly } from '@/lib/api/notifications/queries'

function makeDbReturning(rows: any[]) {
  const chain: any = {
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(rows),
  }
  return { select: jest.fn(() => chain) }
}

describe('getUserProblematicArticlesWeekly', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('scope sin leyes → devuelve [] sin tocar test_questions', async () => {
    ;(getAllowedLawIds as jest.Mock).mockResolvedValue({
      positionType: 'auxiliar_administrativo_estado',
      lawIds: [],
      lawShortNames: [],
    })
    const db = makeDbReturning([])
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getUserProblematicArticlesWeekly({ userId: 'mar' })

    expect(result).toEqual([])
    expect(db.select).not.toHaveBeenCalled()
  })

  test('mapea filas Drizzle al shape ProblematicArticle con recomendación', async () => {
    ;(getAllowedLawIds as jest.Mock).mockResolvedValue({
      positionType: 'auxiliar_administrativo_estado',
      lawIds: ['law-1'],
      lawShortNames: ['CE'],
    })
    const db = makeDbReturning([
      {
        articleId: 'a-1',
        articleNumber: '45',
        lawName: 'CE',
        totalAttempts: 4,
        correctAttempts: 0,
        accuracyPct: '0',
        lastAttemptDate: '2026-04-13T17:05:20.97958+00:00',
      },
      {
        articleId: 'a-2',
        articleNumber: '103',
        lawName: 'CE',
        totalAttempts: 3,
        correctAttempts: 1,
        accuracyPct: '33.3',
        lastAttemptDate: '2026-04-13T10:00:00+00:00',
      },
    ])
    ;(getDb as jest.Mock).mockReturnValue(db)

    const result = await getUserProblematicArticlesWeekly({ userId: 'mar' })

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({
      article_id: 'a-1',
      article_number: '45',
      law_name: 'CE',
      total_attempts: 4,
      correct_attempts: 0,
      accuracy_percentage: 0,
      last_attempt_date: '2026-04-13T17:05:20.97958+00:00',
      recommendation: '📚 Repasar teoría urgente',
    })
    expect(result[1].recommendation).toBe('📖 Repasar conceptos')
  })

  test('pasa el userId correcto a getAllowedLawIds', async () => {
    ;(getAllowedLawIds as jest.Mock).mockResolvedValue({
      positionType: 'x',
      lawIds: [],
      lawShortNames: [],
    })
    ;(getDb as jest.Mock).mockReturnValue(makeDbReturning([]))

    await getUserProblematicArticlesWeekly({ userId: 'user-xyz' })

    expect(getAllowedLawIds).toHaveBeenCalledWith({ userId: 'user-xyz' })
  })
})
