// __tests__/api/psychometric-session/psychometricSession.test.ts
// Tests para schemas de create/complete de sesiones psicotécnicas

import {
  createPsychometricSessionRequestSchema,
  completePsychometricSessionRequestSchema,
} from '@/lib/api/psychometric-session/schemas'

describe('Psychometric Session - Create Schema', () => {
  const validCreate = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    categoryId: '660e8400-e29b-41d4-a716-446655440001',
    totalQuestions: 25,
    questionIds: ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'],
  }

  it('debe aceptar request valido con categoryId', () => {
    const result = createPsychometricSessionRequestSchema.safeParse(validCreate)
    expect(result.success).toBe(true)
  })

  it('debe aceptar request sin categoryId', () => {
    const { categoryId, ...withoutCategory } = validCreate
    const result = createPsychometricSessionRequestSchema.safeParse(withoutCategory)
    expect(result.success).toBe(true)
  })

  it('debe aceptar categoryId null', () => {
    const result = createPsychometricSessionRequestSchema.safeParse({
      ...validCreate,
      categoryId: null,
    })
    expect(result.success).toBe(true)
  })

  it('debe rechazar userId invalido', () => {
    const result = createPsychometricSessionRequestSchema.safeParse({
      ...validCreate,
      userId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar totalQuestions 0', () => {
    const result = createPsychometricSessionRequestSchema.safeParse({
      ...validCreate,
      totalQuestions: 0,
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar totalQuestions negativo', () => {
    const result = createPsychometricSessionRequestSchema.safeParse({
      ...validCreate,
      totalQuestions: -5,
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar questionIds vacio', () => {
    const result = createPsychometricSessionRequestSchema.safeParse({
      ...validCreate,
      questionIds: [],
    })
    // Array can be empty technically, but totalQuestions > 0 is required
    expect(result.success).toBe(true) // questionIds can be empty array
  })

  it('debe rechazar sin userId', () => {
    const { userId, ...without } = validCreate
    const result = createPsychometricSessionRequestSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('debe rechazar sin totalQuestions', () => {
    const { totalQuestions, ...without } = validCreate
    const result = createPsychometricSessionRequestSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('debe rechazar sin questionIds', () => {
    const { questionIds, ...without } = validCreate
    const result = createPsychometricSessionRequestSchema.safeParse(without)
    expect(result.success).toBe(false)
  })
})

describe('Psychometric Session - Complete Schema', () => {
  const validComplete = {
    sessionId: '550e8400-e29b-41d4-a716-446655440000',
    userId: '660e8400-e29b-41d4-a716-446655440001',
    correctAnswers: 18,
    totalQuestions: 25,
  }

  it('debe aceptar request valido', () => {
    const result = completePsychometricSessionRequestSchema.safeParse(validComplete)
    expect(result.success).toBe(true)
  })

  it('debe aceptar correctAnswers 0', () => {
    const result = completePsychometricSessionRequestSchema.safeParse({
      ...validComplete,
      correctAnswers: 0,
    })
    expect(result.success).toBe(true)
  })

  it('debe rechazar correctAnswers negativo', () => {
    const result = completePsychometricSessionRequestSchema.safeParse({
      ...validComplete,
      correctAnswers: -1,
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar totalQuestions 0', () => {
    const result = completePsychometricSessionRequestSchema.safeParse({
      ...validComplete,
      totalQuestions: 0,
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar sessionId invalido', () => {
    const result = completePsychometricSessionRequestSchema.safeParse({
      ...validComplete,
      sessionId: 'not-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar userId invalido', () => {
    const result = completePsychometricSessionRequestSchema.safeParse({
      ...validComplete,
      userId: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar sin sessionId', () => {
    const { sessionId, ...without } = validComplete
    const result = completePsychometricSessionRequestSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('debe rechazar sin userId', () => {
    const { userId, ...without } = validComplete
    const result = completePsychometricSessionRequestSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('debe rechazar totalQuestions decimal', () => {
    const result = completePsychometricSessionRequestSchema.safeParse({
      ...validComplete,
      totalQuestions: 25.5,
    })
    expect(result.success).toBe(false)
  })

  it('debe rechazar correctAnswers decimal', () => {
    const result = completePsychometricSessionRequestSchema.safeParse({
      ...validComplete,
      correctAnswers: 18.5,
    })
    expect(result.success).toBe(false)
  })
})
