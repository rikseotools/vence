/**
 * Simulación completa del sistema de dificultad adaptativa.
 *
 * Simula un usuario respondiendo preguntas con diferentes patrones
 * (todo correcto, todo incorrecto, mixto) y verifica que la dificultad
 * personal se adapta según el rendimiento.
 *
 * Reglas del sistema (adaptiveDifficulty.ts líneas 124-128):
 * - successRate >= 80% → 'easy' (domina la pregunta)
 * - successRate >= 60% → 'medium' (bien pero mejorable)
 * - successRate >= 40% → 'hard' (le cuesta)
 * - successRate < 40%  → 'extreme' (muy difícil para el usuario)
 */

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({}),
}))

import { AdaptiveDifficultyService } from '@/lib/services/adaptiveDifficulty'

function createMockSupabase(testQuestionsData: { is_correct: boolean }[] | null, questionDifficulty: string = 'medium') {
  const mockFrom = jest.fn().mockImplementation((table: string) => {
    if (table === 'test_questions') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: testQuestionsData,
              error: null,
            }),
          }),
        }),
      }
    }
    if (table === 'questions') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { difficulty: questionDifficulty },
              error: null,
            }),
          }),
        }),
      }
    }
    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis() }
  })
  return { from: mockFrom }
}

// ============================================
// SIMULACIÓN: SIN HISTORIAL
// ============================================

describe('Dificultad adaptativa — sin historial previo', () => {
  test('pregunta nunca respondida devuelve difficulty original de BD', async () => {
    const supabase = createMockSupabase(null, 'hard')
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('hard')
    expect(result.success_rate).toBeNull()
    expect(result.total_attempts).toBe(0)
    expect(result.is_personal).toBe(false)
  })

  test('pregunta sin historial y sin difficulty en BD devuelve "medium"', async () => {
    const supabase = createMockSupabase(null, null as any)
    // Override para devolver null
    supabase.from = jest.fn().mockImplementation((table: string) => {
      if (table === 'test_questions') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      }
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { difficulty: null }, error: null }),
          }),
        }),
      }
    })

    const service = new AdaptiveDifficultyService(supabase)
    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('medium')
  })

  test('historial vacío (array []) devuelve difficulty original', async () => {
    const supabase = createMockSupabase([], 'easy')
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('easy')
    expect(result.is_personal).toBe(false)
  })
})

// ============================================
// SIMULACIÓN: USUARIO QUE DOMINA (≥80%)
// ============================================

describe('Dificultad adaptativa — usuario que domina (≥80% aciertos)', () => {
  test('10 respuestas, 10 correctas (100%) → easy', async () => {
    const answers = Array(10).fill({ is_correct: true })
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('easy')
    expect(result.success_rate).toBe(100)
    expect(result.total_attempts).toBe(10)
    expect(result.is_personal).toBe(true)
  })

  test('5 respuestas, 4 correctas (80%) → easy', async () => {
    const answers = [
      { is_correct: true }, { is_correct: true }, { is_correct: true },
      { is_correct: true }, { is_correct: false },
    ]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('easy')
    expect(result.success_rate).toBe(80)
  })
})

// ============================================
// SIMULACIÓN: USUARIO MEDIO (60-79%)
// ============================================

describe('Dificultad adaptativa — usuario medio (60-79% aciertos)', () => {
  test('10 respuestas, 7 correctas (70%) → medium', async () => {
    const answers = [
      ...Array(7).fill({ is_correct: true }),
      ...Array(3).fill({ is_correct: false }),
    ]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('medium')
    expect(result.success_rate).toBe(70)
    expect(result.is_personal).toBe(true)
  })

  test('5 respuestas, 3 correctas (60%) → medium', async () => {
    const answers = [
      { is_correct: true }, { is_correct: true }, { is_correct: true },
      { is_correct: false }, { is_correct: false },
    ]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('medium')
    expect(result.success_rate).toBe(60)
  })

  test('10 respuestas, 6 correctas (60%) → medium (boundary)', async () => {
    const answers = [
      ...Array(6).fill({ is_correct: true }),
      ...Array(4).fill({ is_correct: false }),
    ]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('medium')
    expect(result.success_rate).toBe(60)
  })
})

// ============================================
// SIMULACIÓN: USUARIO QUE LE CUESTA (40-59%)
// ============================================

describe('Dificultad adaptativa — usuario que le cuesta (40-59% aciertos)', () => {
  test('10 respuestas, 5 correctas (50%) → hard', async () => {
    const answers = [
      ...Array(5).fill({ is_correct: true }),
      ...Array(5).fill({ is_correct: false }),
    ]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('hard')
    expect(result.success_rate).toBe(50)
  })

  test('5 respuestas, 2 correctas (40%) → hard (boundary)', async () => {
    const answers = [
      { is_correct: true }, { is_correct: true },
      { is_correct: false }, { is_correct: false }, { is_correct: false },
    ]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('hard')
    expect(result.success_rate).toBe(40)
  })
})

// ============================================
// SIMULACIÓN: USUARIO QUE FALLA MUCHO (<40%)
// ============================================

describe('Dificultad adaptativa — usuario que falla mucho (<40% aciertos)', () => {
  test('10 respuestas, 3 correctas (30%) → extreme', async () => {
    const answers = [
      ...Array(3).fill({ is_correct: true }),
      ...Array(7).fill({ is_correct: false }),
    ]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('extreme')
    expect(result.success_rate).toBe(30)
  })

  test('10 respuestas, 0 correctas (0%) → extreme', async () => {
    const answers = Array(10).fill({ is_correct: false })
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('extreme')
    expect(result.success_rate).toBe(0)
    expect(result.total_attempts).toBe(10)
  })

  test('1 respuesta incorrecta (0%) → extreme', async () => {
    const answers = [{ is_correct: false }]
    const supabase = createMockSupabase(answers)
    const service = new AdaptiveDifficultyService(supabase)

    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('extreme')
    expect(result.success_rate).toBe(0)
    expect(result.total_attempts).toBe(1)
  })
})

// ============================================
// SIMULACIÓN: PROGRESIÓN DE UN USUARIO
// ============================================

describe('Dificultad adaptativa — simulación de progresión', () => {
  test('usuario empieza fallando y va mejorando', async () => {
    const service = new AdaptiveDifficultyService(null as any)

    // Ronda 1: todo mal (0%) → extreme
    let supabase = createMockSupabase([
      { is_correct: false }, { is_correct: false }, { is_correct: false },
    ])
    ;(service as any).supabase = supabase
    let result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('extreme')

    // Ronda 2: empieza a acertar (33%) → extreme todavía
    supabase = createMockSupabase([
      { is_correct: false }, { is_correct: false }, { is_correct: false },
      { is_correct: true },
    ])
    ;(service as any).supabase = supabase
    result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('extreme')

    // Ronda 3: mejora (50%) → hard
    supabase = createMockSupabase([
      { is_correct: false }, { is_correct: false },
      { is_correct: true }, { is_correct: true },
    ])
    ;(service as any).supabase = supabase
    result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('hard')

    // Ronda 4: buen rendimiento (75%) → medium
    supabase = createMockSupabase([
      { is_correct: false },
      { is_correct: true }, { is_correct: true }, { is_correct: true },
    ])
    ;(service as any).supabase = supabase
    result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('medium')

    // Ronda 5: domina (100%) → easy
    supabase = createMockSupabase([
      { is_correct: true }, { is_correct: true }, { is_correct: true },
      { is_correct: true }, { is_correct: true },
    ])
    ;(service as any).supabase = supabase
    result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('easy')
  })

  test('error de Supabase devuelve fallback seguro', async () => {
    const supabase = {
      from: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'SOME_ERROR', message: 'DB down' },
            }),
          }),
        }),
      })),
    }

    const service = new AdaptiveDifficultyService(supabase)
    const result = await service.getPersonalDifficulty('user-1', 'q-1')

    expect(result.personal_difficulty).toBe('medium')
    expect(result.is_personal).toBe(false)
    expect(result.total_attempts).toBe(0)
  })
})

// ============================================
// SIMULACIÓN: BOUNDARIES EXACTOS
// ============================================

describe('Dificultad adaptativa — boundaries exactos', () => {
  test('79% → medium (justo debajo de easy)', async () => {
    // 79/100 = 79%
    const answers = [
      ...Array(79).fill({ is_correct: true }),
      ...Array(21).fill({ is_correct: false }),
    ]
    const service = new AdaptiveDifficultyService(createMockSupabase(answers))
    const result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('medium')
  })

  test('80% → easy (boundary exacto)', async () => {
    const answers = [
      ...Array(80).fill({ is_correct: true }),
      ...Array(20).fill({ is_correct: false }),
    ]
    const service = new AdaptiveDifficultyService(createMockSupabase(answers))
    const result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('easy')
  })

  test('59% → hard (justo debajo de medium)', async () => {
    const answers = [
      ...Array(59).fill({ is_correct: true }),
      ...Array(41).fill({ is_correct: false }),
    ]
    const service = new AdaptiveDifficultyService(createMockSupabase(answers))
    const result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('hard')
  })

  test('39% → extreme (justo debajo de hard)', async () => {
    const answers = [
      ...Array(39).fill({ is_correct: true }),
      ...Array(61).fill({ is_correct: false }),
    ]
    const service = new AdaptiveDifficultyService(createMockSupabase(answers))
    const result = await service.getPersonalDifficulty('user-1', 'q-1')
    expect(result.personal_difficulty).toBe('extreme')
  })
})
