// __tests__/api/v2/dispute/disputeSchemas.test.ts

import {
  createDisputeRequestSchema,
  getDisputeRequestSchema,
  questionTypeSchema,
  disputeTypeSchema,
} from '@/lib/api/v2/dispute/schemas'
import {
  ALL_DISPUTE_TYPES,
  LEGISLATIVE_DISPUTE_TYPES,
  PSYCHOMETRIC_DISPUTE_TYPES,
  COMMON_DISPUTE_TYPES,
  LEGISLATIVE_ONLY_TYPES,
  PSYCHOMETRIC_ONLY_TYPES,
  DISPUTE_TYPE_LABELS,
} from '@/lib/api/v2/dispute/types'

// ============================================
// SYNC: Fuente de verdad unica (types.ts)
// ============================================

describe('Dispute V2 - Sincronizacion fuente de verdad', () => {
  it('el schema Zod acepta exactamente los mismos tipos que ALL_DISPUTE_TYPES', () => {
    const zodValues = disputeTypeSchema.options
    expect([...zodValues].sort()).toEqual([...ALL_DISPUTE_TYPES].sort())
  })

  it('LEGISLATIVE = LEGISLATIVE_ONLY + COMMON', () => {
    expect([...LEGISLATIVE_DISPUTE_TYPES].sort()).toEqual(
      [...LEGISLATIVE_ONLY_TYPES, ...COMMON_DISPUTE_TYPES].sort()
    )
  })

  it('PSYCHOMETRIC = PSYCHOMETRIC_ONLY + COMMON', () => {
    expect([...PSYCHOMETRIC_DISPUTE_TYPES].sort()).toEqual(
      [...PSYCHOMETRIC_ONLY_TYPES, ...COMMON_DISPUTE_TYPES].sort()
    )
  })

  it('todos los tipos tienen label en DISPUTE_TYPE_LABELS', () => {
    for (const type of ALL_DISPUTE_TYPES) {
      expect(DISPUTE_TYPE_LABELS[type]).toBeDefined()
      expect(DISPUTE_TYPE_LABELS[type].length).toBeGreaterThan(0)
    }
  })

  it('no hay tipos exclusivos en ambas listas', () => {
    const overlap = LEGISLATIVE_ONLY_TYPES.filter((t: string) =>
      (PSYCHOMETRIC_ONLY_TYPES as readonly string[]).includes(t)
    )
    expect(overlap).toHaveLength(0)
  })
})

// ============================================
// TESTS ORIGINALES
// ============================================

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
  it.each([...ALL_DISPUTE_TYPES])('acepta %s', (type) => {
    expect(disputeTypeSchema.safeParse(type).success).toBe(true)
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

  // Tipos comunes: aceptados para ambos tipos de pregunta
  it.each([...COMMON_DISPUTE_TYPES])('acepta %s para legislativa', (type) => {
    const result = createDisputeRequestSchema.safeParse({
      ...validLegislative,
      disputeType: type,
    })
    expect(result.success).toBe(true)
  })

  it.each([...COMMON_DISPUTE_TYPES])('acepta %s para psicotecnica', (type) => {
    const result = createDisputeRequestSchema.safeParse({
      ...validPsychometric,
      disputeType: type,
    })
    expect(result.success).toBe(true)
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
