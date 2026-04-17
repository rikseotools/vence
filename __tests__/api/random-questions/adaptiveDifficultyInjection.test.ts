/**
 * Test para verificar que AdaptiveDifficultyService acepta un supabaseClient
 * inyectado (service_role) y lo usa en vez del singleton (anon key).
 * Esto es crítico para que la query a questions funcione con RLS cerrada.
 */

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          single: jest.fn().mockResolvedValue({ data: { difficulty: 'easy' }, error: null }),
        }),
      }),
    }),
  }),
}))

import { AdaptiveDifficultyService } from '@/lib/services/adaptiveDifficulty'

describe('AdaptiveDifficultyService — client injection', () => {
  test('constructor sin parámetro usa el default client', () => {
    const service = new AdaptiveDifficultyService()
    expect(service).toBeDefined()
  })

  test('constructor con client inyectado usa ese client', async () => {
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          single: jest.fn().mockResolvedValue({ data: { difficulty: 'hard' }, error: null }),
        }),
      }),
    })
    const injectedClient = { from: mockFrom }

    const service = new AdaptiveDifficultyService(injectedClient)
    const result = await service.getPersonalDifficulty('user-1', 'question-1')

    // Debe haber usado el client inyectado, no el default
    expect(mockFrom).toHaveBeenCalledWith('test_questions')
    expect(result.personal_difficulty).toBe('hard')
    expect(result.is_personal).toBe(false)
  })

  test('sin historial devuelve difficulty de la pregunta', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: { difficulty: 'extreme' },
      error: null,
    })
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          single: mockSingle,
        }),
      }),
    })
    const injectedClient = { from: mockFrom }

    const service = new AdaptiveDifficultyService(injectedClient)
    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('extreme')
    expect(result.total_attempts).toBe(0)
    expect(result.is_personal).toBe(false)
  })

  test('sin difficulty en la pregunta devuelve "medium" como default', async () => {
    const mockSingle = jest.fn().mockResolvedValue({
      data: { difficulty: null },
      error: null,
    })
    const mockFrom = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          single: mockSingle,
        }),
      }),
    })
    const injectedClient = { from: mockFrom }

    const service = new AdaptiveDifficultyService(injectedClient)
    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('medium')
  })

  test('query a questions usa this.supabase (inyectado), no el global', async () => {
    const calls: string[] = []

    const mockFrom = jest.fn().mockImplementation((table: string) => {
      calls.push(table)
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            single: jest.fn().mockResolvedValue({ data: { difficulty: 'medium' }, error: null }),
          }),
        }),
      }
    })

    const service = new AdaptiveDifficultyService({ from: mockFrom })
    await service.getPersonalDifficulty('user-1', 'q-1')

    // Debe haber llamado a test_questions y luego a questions
    expect(calls).toContain('test_questions')
    expect(calls).toContain('questions')
  })
})
