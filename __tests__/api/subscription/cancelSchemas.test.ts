// __tests__/api/subscription/cancelSchemas.test.ts
//
// Tests de los schemas del flujo de cancelación post-refactor (15/04/2026,
// caso Almudena Martos). Verifican:
// - feedback es opcional en cancelSubscriptionRequestSchema
// - nuevas razones 'exam_done' y 'pending_feedback' son válidas
// - submitCancellationFeedbackRequestSchema requiere userId + feedback completo

import {
  cancelSubscriptionRequestSchema,
  cancellationFeedbackSchema,
  cancellationReasons,
  submitCancellationFeedbackRequestSchema,
  safeParseCancelSubscriptionRequest,
  safeParseSubmitCancellationFeedback,
} from '@/lib/api/subscription/schemas'

describe('cancelSubscriptionRequestSchema — feedback opcional (post-15/04/2026)', () => {
  const validUserId = '00000000-0000-0000-0000-000000000001'

  test('acepta request sin feedback (flujo 1-clic)', () => {
    const result = cancelSubscriptionRequestSchema.safeParse({ userId: validUserId })
    expect(result.success).toBe(true)
  })

  test('acepta request con feedback completo (regresión, flujo legacy)', () => {
    const result = cancelSubscriptionRequestSchema.safeParse({
      userId: validUserId,
      feedback: {
        reason: 'too_expensive',
        reasonDetails: 'Comentario opcional',
      },
    })
    expect(result.success).toBe(true)
  })

  test('acepta request con feedback parcial (solo reason)', () => {
    const result = cancelSubscriptionRequestSchema.safeParse({
      userId: validUserId,
      feedback: { reason: 'approved' },
    })
    expect(result.success).toBe(true)
  })

  test('rechaza userId no-uuid', () => {
    const result = cancelSubscriptionRequestSchema.safeParse({ userId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  test('rechaza feedback con reason inválida', () => {
    const result = cancelSubscriptionRequestSchema.safeParse({
      userId: validUserId,
      feedback: { reason: 'reason_que_no_existe' },
    })
    expect(result.success).toBe(false)
  })
})

describe('cancellationReasons — incluye nuevas razones', () => {
  test('incluye "exam_done" (nueva opción post-15/04/2026)', () => {
    expect(cancellationReasons).toContain('exam_done')
  })

  test('incluye "pending_feedback" (marcador interno 1-clic)', () => {
    expect(cancellationReasons).toContain('pending_feedback')
  })

  test('mantiene razones clásicas (regresión)', () => {
    for (const r of ['approved', 'not_presenting', 'too_expensive', 'prefer_other', 'missing_features', 'no_progress', 'hard_to_use', 'other']) {
      expect(cancellationReasons).toContain(r)
    }
  })
})

describe('cancellationFeedbackSchema — exam_done es válido', () => {
  test('parsea feedback con reason exam_done', () => {
    const result = cancellationFeedbackSchema.safeParse({ reason: 'exam_done' })
    expect(result.success).toBe(true)
  })

  test('parsea feedback con reason pending_feedback', () => {
    const result = cancellationFeedbackSchema.safeParse({ reason: 'pending_feedback' })
    expect(result.success).toBe(true)
  })

  test('rechaza reasonDetails >1000 chars', () => {
    const longText = 'a'.repeat(1001)
    const result = cancellationFeedbackSchema.safeParse({ reason: 'other', reasonDetails: longText })
    expect(result.success).toBe(false)
  })
})

describe('submitCancellationFeedbackRequestSchema — POST /api/stripe/cancel/feedback', () => {
  const validUserId = '00000000-0000-0000-0000-000000000002'

  test('acepta payload válido con reason y textarea', () => {
    const result = submitCancellationFeedbackRequestSchema.safeParse({
      userId: validUserId,
      feedback: { reason: 'exam_done', reasonDetails: 'Aprobé el examen, gracias' },
    })
    expect(result.success).toBe(true)
  })

  test('acepta payload con solo reason (textarea opcional)', () => {
    const result = submitCancellationFeedbackRequestSchema.safeParse({
      userId: validUserId,
      feedback: { reason: 'too_expensive' },
    })
    expect(result.success).toBe(true)
  })

  test('rechaza si falta feedback', () => {
    const result = submitCancellationFeedbackRequestSchema.safeParse({ userId: validUserId })
    expect(result.success).toBe(false)
  })

  test('rechaza si falta reason dentro de feedback', () => {
    const result = submitCancellationFeedbackRequestSchema.safeParse({
      userId: validUserId,
      feedback: { reasonDetails: 'texto libre sin razón' },
    })
    expect(result.success).toBe(false)
  })
})

describe('helpers safeParse — integración', () => {
  test('safeParseCancelSubscriptionRequest acepta 1-clic', () => {
    const r = safeParseCancelSubscriptionRequest({ userId: '00000000-0000-0000-0000-000000000003' })
    expect(r.success).toBe(true)
  })

  test('safeParseSubmitCancellationFeedback devuelve fieldErrors útiles', () => {
    const r = safeParseSubmitCancellationFeedback({ userId: 'bad-uuid' })
    expect(r.success).toBe(false)
    if (!r.success) {
      const flat = r.error.flatten()
      expect(flat.fieldErrors.userId?.length).toBeGreaterThan(0)
      expect(flat.fieldErrors.feedback?.length).toBeGreaterThan(0)
    }
  })
})
