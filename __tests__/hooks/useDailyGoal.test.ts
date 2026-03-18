/**
 * Tests para el hook useDailyGoal y la validación de studyGoal
 *
 * Bug: El schema Zod tenía studyGoal max(200) pero el input HTML max="100".
 * Usuarios que ponían metas > 200 recibían "Datos de perfil inválidos"
 * sin saber qué campo fallaba.
 *
 * Fix: Límite subido a 9999, validación frontend antes de enviar,
 * y sistema de celebración cuando se alcanza la meta diaria.
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
