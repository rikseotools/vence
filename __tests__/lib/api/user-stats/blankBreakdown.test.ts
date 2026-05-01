// __tests__/lib/api/user-stats/blankBreakdown.test.ts
//
// Tests del desglose correctas/falladas/en blanco en getUserPublicStats.
// Añadido 15/4/2026 con la feature "Dejar en blanco" (sugerencia Tinokero).

// Mock del db client con filas simuladas. El factory es self-contained por
// la restricción de hoisting de jest.mock.
jest.mock('@/db/client', () => {
  let mockStatsResult: { totalQuestions: number; correctAnswers: number; blankAnswers: number; questionsThisWeek: number } | null = null
  let mockStreakResult: { currentStreak: number } | null = null
  return {
    __setMockStats: (v: typeof mockStatsResult) => { mockStatsResult = v },
    __setMockStreak: (v: typeof mockStreakResult) => { mockStreakResult = v },
    getDb: () => ({
      execute: () => Promise.resolve(mockStatsResult ? [{
        total_questions: mockStatsResult.totalQuestions,
        correct_answers: mockStatsResult.correctAnswers,
        blank_answers: mockStatsResult.blankAnswers,
        questions_this_week: mockStatsResult.questionsThisWeek,
        week_start: new Date().toISOString().slice(0, 10),
      }] : []),
      select: () => ({
        from: (table: unknown) => {
          const tableName = String(table) || ''
          const isUserStreaks = tableName.includes('user_streaks')
          return {
            innerJoin: () => ({
              where: () => Promise.resolve(mockStatsResult ? [mockStatsResult] : []),
            }),
            where: () => ({
              limit: () => Promise.resolve(isUserStreaks && mockStreakResult ? [mockStreakResult] : []),
            }),
          }
        },
      }),
    }),
  }
})

import { getUserPublicStats } from '@/lib/api/user-stats/queries'

const dbMock = jest.requireMock('@/db/client') as {
  __setMockStats: (v: { totalQuestions: number; correctAnswers: number; blankAnswers: number; questionsThisWeek: number } | null) => void
  __setMockStreak: (v: { currentStreak: number } | null) => void
}

describe('getUserPublicStats — desglose correctas/falladas/en blanco', () => {
  const USER_ID = '00000000-0000-0000-0000-000000000001'

  test('sin actividad: todos 0', async () => {
    dbMock.__setMockStats({ totalQuestions: 0, correctAnswers: 0, blankAnswers: 0, questionsThisWeek: 0 })
    dbMock.__setMockStreak(null)
    const stats = await getUserPublicStats(USER_ID)
    expect(stats.totalQuestions).toBe(0)
    expect(stats.correctAnswers).toBe(0)
    expect(stats.incorrectAnswers).toBe(0)
    expect(stats.blankAnswers).toBe(0)
    expect(stats.globalAccuracy).toBe(0)
  })

  test('caso simple: 8 correctas, 2 falladas, 0 blancas → 80% accuracy', async () => {
    dbMock.__setMockStats({ totalQuestions: 10, correctAnswers: 8, blankAnswers: 0, questionsThisWeek: 10 })
    const stats = await getUserPublicStats(USER_ID)
    expect(stats.totalQuestions).toBe(10)
    expect(stats.correctAnswers).toBe(8)
    expect(stats.incorrectAnswers).toBe(2)
    expect(stats.blankAnswers).toBe(0)
    expect(stats.globalAccuracy).toBe(80)
  })

  test('exploit test: 1 correcta + 24 en blanco → 4% accuracy (NO 100%)', async () => {
    dbMock.__setMockStats({ totalQuestions: 25, correctAnswers: 1, blankAnswers: 24, questionsThisWeek: 25 })
    const stats = await getUserPublicStats(USER_ID)
    expect(stats.correctAnswers).toBe(1)
    expect(stats.incorrectAnswers).toBe(0)
    expect(stats.blankAnswers).toBe(24)
    expect(stats.globalAccuracy).toBe(4) // 1/25 = 4%
  })

  test('mezcla realista: 15 correctas + 8 falladas + 2 blancas = 25 total, 60% accuracy', async () => {
    dbMock.__setMockStats({ totalQuestions: 25, correctAnswers: 15, blankAnswers: 2, questionsThisWeek: 5 })
    const stats = await getUserPublicStats(USER_ID)
    expect(stats.correctAnswers).toBe(15)
    expect(stats.incorrectAnswers).toBe(8)
    expect(stats.blankAnswers).toBe(2)
    expect(stats.globalAccuracy).toBe(60) // 15/25
  })

  test('invariante: correctas + falladas + blancas === total', async () => {
    dbMock.__setMockStats({ totalQuestions: 100, correctAnswers: 70, blankAnswers: 10, questionsThisWeek: 100 })
    const stats = await getUserPublicStats(USER_ID)
    expect(stats.correctAnswers + stats.incorrectAnswers + stats.blankAnswers).toBe(stats.totalQuestions)
  })

  test('incorrectAnswers nunca negativo si los datos están corruptos (total=10, correct=8, blank=5)', async () => {
    // Defensa: si por algún motivo blank>total-correct (no debería pasar),
    // Math.max(0, incorrect) evita negativos en la UI.
    dbMock.__setMockStats({ totalQuestions: 10, correctAnswers: 8, blankAnswers: 5, questionsThisWeek: 10 })
    const stats = await getUserPublicStats(USER_ID)
    expect(stats.incorrectAnswers).toBeGreaterThanOrEqual(0)
  })
})
