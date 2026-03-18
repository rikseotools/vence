// __tests__/api/v2/dispute/disputeSchemas.test.ts

import {
  createDisputeRequestSchema,
  getDisputeRequestSchema,
  questionTypeSchema,
  disputeTypeSchema,
} from '@/lib/api/v2/dispute/schemas'

describe('Dispute V2 - QuestionType Schema', () => {
  it('acepta legislative', () => {
    expect(questionTypeSchema.safeParse('legislative').success).toBe(true)
  })
  it('acepta psychometric', () => {
    expect(questionTypeSchema.safeParse('psychometric').success).toBe(true)
  })
  it('rechaza valor invalido', () => {
    expect(questionTypeSchema.safeParse('other').success).toBe(false)
  })
})

describe('Dispute V2 - DisputeType Schema', () => {
  it('acepta no_literal', () => {
    expect(disputeTypeSchema.safeParse('no_literal').success).toBe(true)
  })
  it('acepta ai_detected_error', () => {
    expect(disputeTypeSchema.safeParse('ai_detected_error').success).toBe(true)
  })
  it('acepta respuesta_incorrecta', () => {
    expect(disputeTypeSchema.safeParse('respuesta_incorrecta').success).toBe(true)
  })
  it('acepta otro', () => {
    expect(disputeTypeSchema.safeParse('otro').success).toBe(true)
  })
  it('rechaza valor invalido', () => {
    expect(disputeTypeSchema.safeParse('invalid').success).toBe(false)
  })
})

describe('Dispute V2 - CreateDispute Schema', () => {
  const validLegislative = {
    questionId: '550e8400-e29b-41d4-a716-446655440000',
    questionType: 'legislative',
    disputeType: 'no_literal',
    description: 'Esta pregunta no se ajusta al articulo correctamente',
  }

  const validPsychometric = {
    questionId: '550e8400-e29b-41d4-a716-446655440000',
    questionType: 'psychometric',
    disputeType: 'ai_detected_error',
    description: 'La respuesta marcada como correcta no es la correcta',
  }

  it('acepta impugnacion legislativa con no_literal', () => {
    expect(createDisputeRequestSchema.safeParse(validLegislative).success).toBe(true)
  })

  it('acepta impugnacion psicotecnica con ai_detected_error', () => {
    expect(createDisputeRequestSchema.safeParse(validPsychometric).success).toBe(true)
  })

  it('acepta respuesta_incorrecta para legislativa', () => {
    const result = createDisputeRequestSchema.safeParse({
      ...validLegislative,
      disputeType: 'respuesta_incorrecta',
    })
    expect(result.success).toBe(true)
  })

  it('acepta respuesta_incorrecta para psicotecnica', () => {
    const result = createDisputeRequestSchema.safeParse({
      ...validPsychometric,
      disputeType: 'respuesta_incorrecta',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza no_literal para psicotecnica', () => {
    const result = createDisputeRequestSchema.safeParse({
      ...validPsychometric,
      disputeType: 'no_literal',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza ai_detected_error para legislativa', () => {
    const result = createDisputeRequestSchema.safeParse({
      ...validLegislative,
      disputeType: 'ai_detected_error',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza descripcion menor a 10 caracteres', () => {
    const result = createDisputeRequestSchema.safeParse({
      ...validLegislative,
      description: 'corta',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza descripcion mayor a 500 caracteres', () => {
    const result = createDisputeRequestSchema.safeParse({
      ...validLegislative,
      description: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rechaza questionId invalido', () => {
    const result = createDisputeRequestSchema.safeParse({
      ...validLegislative,
      questionId: 'not-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rechaza sin questionType', () => {
    const { questionType, ...without } = validLegislative
    const result = createDisputeRequestSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('rechaza sin description', () => {
    const { description, ...without } = validLegislative
    const result = createDisputeRequestSchema.safeParse(without)
    expect(result.success).toBe(false)
  })

  it('acepta otro para ambos tipos', () => {
    expect(createDisputeRequestSchema.safeParse({ ...validLegislative, disputeType: 'otro' }).success).toBe(true)
    expect(createDisputeRequestSchema.safeParse({ ...validPsychometric, disputeType: 'otro' }).success).toBe(true)
  })
})

describe('Dispute V2 - GetDispute Schema', () => {
  it('acepta request valido legislative', () => {
    const result = getDisputeRequestSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      questionType: 'legislative',
    })
    expect(result.success).toBe(true)
  })

  it('acepta request valido psychometric', () => {
    const result = getDisputeRequestSchema.safeParse({
      questionId: '550e8400-e29b-41d4-a716-446655440000',
      questionType: 'psychometric',
    })
    expect(result.success).toBe(true)
  })

  it('rechaza questionId invalido', () => {
    const result = getDisputeRequestSchema.safeParse({
      questionId: 'bad',
      questionType: 'legislative',
    })
    expect(result.success).toBe(false)
  })
})
