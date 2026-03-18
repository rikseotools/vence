/**
 * Tests para el hook useDailyGoal y la validación de studyGoal
 *
 * Bug: El schema Zod tenía studyGoal max(200) pero el input HTML max="100".
 * Usuarios que ponían metas > 200 recibían "Datos de perfil inválidos"
 * sin saber qué campo fallaba.
 *
 * Fix: Límite subido a 9999, validación frontend antes de enviar,
 * meta por defecto = media personal de la última semana,
 * barra de progreso en Header, y confetti al alcanzar la meta.
 */

// ============================================
// TEST: Validación del schema de perfil
// ============================================
describe('Profile studyGoal validation', () => {
  let updateProfileRequestSchema: any

  beforeAll(async () => {
    const mod = await import('@/lib/api/profile/schemas')
    updateProfileRequestSchema = mod.updateProfileRequestSchema
  })

  const baseRequest = (studyGoal: number) => ({
    userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    data: { studyGoal },
  })

  it('should accept studyGoal of 1 (minimum)', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(1))
    expect(result.success).toBe(true)
  })

  it('should accept studyGoal of 25 (default)', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(25))
    expect(result.success).toBe(true)
  })

  it('should accept studyGoal of 200 (old max that was too low)', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(200))
    expect(result.success).toBe(true)
  })

  it('should accept studyGoal of 500 (the value the user tried)', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(500))
    expect(result.success).toBe(true)
  })

  it('should accept studyGoal of 1000', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(1000))
    expect(result.success).toBe(true)
  })

  it('should reject studyGoal of 0', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(0))
    expect(result.success).toBe(false)
  })

  it('should reject negative studyGoal', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(-1))
    expect(result.success).toBe(false)
  })

  it('should reject studyGoal > 9999', () => {
    const result = updateProfileRequestSchema.safeParse(baseRequest(10000))
    expect(result.success).toBe(false)
  })
})

// ============================================
// TEST: Lógica de celebración de meta diaria
// ============================================
describe('Daily goal celebration logic', () => {
  // Simula la lógica del hook useDailyGoal
  function simulateGoalTracking(studyGoal: number, initialCount: number) {
    let questionsToday = initialCount
    let celebrated = initialCount >= studyGoal

    function recordAnswer() {
      questionsToday++
      const nowReached = questionsToday >= studyGoal
      const justReached = nowReached && !celebrated
      if (justReached) celebrated = true
      return { questionsToday, goalReached: nowReached, justReachedGoal: justReached }
    }

    return { recordAnswer, getCount: () => questionsToday }
  }

  it('should trigger celebration when goal is reached exactly', () => {
    const tracker = simulateGoalTracking(3, 2)
    const result = tracker.recordAnswer() // 3rd question
    expect(result.questionsToday).toBe(3)
    expect(result.goalReached).toBe(true)
    expect(result.justReachedGoal).toBe(true)
  })

  it('should not trigger celebration again after first time', () => {
    const tracker = simulateGoalTracking(2, 1)
    const first = tracker.recordAnswer() // reaches goal
    expect(first.justReachedGoal).toBe(true)
    const second = tracker.recordAnswer() // exceeds goal
    expect(second.goalReached).toBe(true)
    expect(second.justReachedGoal).toBe(false)
  })

  it('should not celebrate if goal was already reached before session', () => {
    const tracker = simulateGoalTracking(5, 10) // already at 10, goal is 5
    const result = tracker.recordAnswer()
    expect(result.goalReached).toBe(true)
    expect(result.justReachedGoal).toBe(false)
  })

  it('should work with high goals', () => {
    const tracker = simulateGoalTracking(500, 499)
    const result = tracker.recordAnswer()
    expect(result.justReachedGoal).toBe(true)
    expect(result.questionsToday).toBe(500)
  })

  it('should work with goal of 1', () => {
    const tracker = simulateGoalTracking(1, 0)
    const result = tracker.recordAnswer()
    expect(result.justReachedGoal).toBe(true)
  })
})

// ============================================
// TEST: Consistencia HTML input y schema
// ============================================
describe('studyGoal limits consistency', () => {
  const fs = require('fs')

  it('perfil page input max should match schema max', () => {
    const perfilContent = fs.readFileSync('app/perfil/page.tsx', 'utf-8')
    const schemaContent = fs.readFileSync('lib/api/profile/schemas.ts', 'utf-8')

    // Extract max from input
    const inputMaxMatch = perfilContent.match(/name="study_goal"[\s\S]*?max="(\d+)"/)
    const inputMax = inputMaxMatch ? parseInt(inputMaxMatch[1]) : null

    // Extract max from schema (update request)
    const schemaMaxMatch = schemaContent.match(/studyGoal:\s*z\.number\(\)\.int\(\)\.min\(\d+\)\.max\((\d+)\)\.optional\(\)/)
    const schemaMax = schemaMaxMatch ? parseInt(schemaMaxMatch[1]) : null

    expect(inputMax).not.toBeNull()
    expect(schemaMax).not.toBeNull()
    expect(inputMax).toBe(schemaMax)
  })

  it('perfil page input min should match schema min', () => {
    const perfilContent = fs.readFileSync('app/perfil/page.tsx', 'utf-8')
    const schemaContent = fs.readFileSync('lib/api/profile/schemas.ts', 'utf-8')

    const inputMinMatch = perfilContent.match(/name="study_goal"[\s\S]*?min="(\d+)"/)
    const inputMin = inputMinMatch ? parseInt(inputMinMatch[1]) : null

    const schemaMinMatch = schemaContent.match(/studyGoal:\s*z\.number\(\)\.int\(\)\.min\((\d+)\)/)
    const schemaMin = schemaMinMatch ? parseInt(schemaMinMatch[1]) : null

    expect(inputMin).not.toBeNull()
    expect(schemaMin).not.toBeNull()
    expect(inputMin).toBe(schemaMin)
  })
})

// ============================================
// TEST: Cálculo de meta por defecto (media semanal)
// ============================================
describe('Default goal calculation (weekly average)', () => {
  // Replica la lógica de useDailyGoal para calcular la meta por defecto
  function calculateDefaultGoal(weekCount: number): number {
    if (weekCount <= 0) return 25 // Fallback sin historial
    const rawAvg = weekCount / 7
    return Math.max(5, Math.round(rawAvg / 5) * 5)
  }

  it('should return 25 as fallback when no history', () => {
    expect(calculateDefaultGoal(0)).toBe(25)
  })

  it('should round to nearest multiple of 5', () => {
    // 70 questions / 7 days = 10/day → 10
    expect(calculateDefaultGoal(70)).toBe(10)
    // 140 / 7 = 20 → 20
    expect(calculateDefaultGoal(140)).toBe(20)
    // 175 / 7 = 25 → 25
    expect(calculateDefaultGoal(175)).toBe(25)
  })

  it('should handle low averages with minimum of 5', () => {
    // 7 questions / 7 days = 1/day → min 5
    expect(calculateDefaultGoal(7)).toBe(5)
    // 3 / 7 = 0.43 → rounds to 0, but min is 5
    expect(calculateDefaultGoal(3)).toBe(5)
  })

  it('should handle high averages', () => {
    // 700 / 7 = 100 → 100
    expect(calculateDefaultGoal(700)).toBe(100)
    // 350 / 7 = 50 → 50
    expect(calculateDefaultGoal(350)).toBe(50)
    // 500 / 7 ≈ 71.4 → rounds to 70
    expect(calculateDefaultGoal(500)).toBe(70)
  })

  it('should produce reasonable goals for typical users', () => {
    // Casual user: ~15 questions/day
    expect(calculateDefaultGoal(105)).toBe(15)
    // Active user: ~50 questions/day
    expect(calculateDefaultGoal(350)).toBe(50)
    // Very active: ~200/day
    expect(calculateDefaultGoal(1400)).toBe(200)
  })
})

// ============================================
// TEST: Solo premium (FREE tiene límite fijo de 25)
// ============================================
describe('Daily goal is premium-only', () => {
  const fs = require('fs')

  it('useDailyGoal should check isPremium', () => {
    const content = fs.readFileSync('hooks/useDailyGoal.ts', 'utf-8')
    expect(content).toContain('isPremium')
  })

  it('DailyGoalBanner should only render for premium', () => {
    const content = fs.readFileSync('components/DailyGoalBanner.tsx', 'utf-8')
    expect(content).toContain('!isPremium')
    // Should return null for non-premium
    expect(content).toMatch(/if.*!isPremium.*return null/)
  })
})
