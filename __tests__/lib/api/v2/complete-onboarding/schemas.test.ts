// __tests__/lib/api/v2/complete-onboarding/schemas.test.ts
import { completeOnboardingRequestSchema, completeOnboardingResponseSchema } from '@/lib/api/v2/complete-onboarding/schemas'

describe('completeOnboardingRequestSchema', () => {
  const validPayload = {
    targetOposicion: 'auxiliar_administrativo_estado',
    age: 30,
    gender: 'Mujer',
    ciudad: 'Madrid',
  }

  it('acepta payload completo con todos los campos', () => {
    const result = completeOnboardingRequestSchema.safeParse({
      ...validPayload,
      targetOposicionData: { id: 'aux', name: 'Auxiliar' },
      dailyStudyHours: 3,
    })
    expect(result.success).toBe(true)
  })

  it('acepta payload mínimo sin campos opcionales', () => {
    const result = completeOnboardingRequestSchema.safeParse(validPayload)
    expect(result.success).toBe(true)
  })

  it('rechaza sin targetOposicion', () => {
    const { targetOposicion, ...rest } = validPayload
    const result = completeOnboardingRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rechaza sin edad', () => {
    const { age, ...rest } = validPayload
    const result = completeOnboardingRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rechaza sin género', () => {
    const { gender, ...rest } = validPayload
    const result = completeOnboardingRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rechaza sin ciudad', () => {
    const { ciudad, ...rest } = validPayload
    const result = completeOnboardingRequestSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rechaza ciudad vacía', () => {
    const result = completeOnboardingRequestSchema.safeParse({ ...validPayload, ciudad: '' })
    expect(result.success).toBe(false)
  })

  it('rechaza edad < 16', () => {
    const result = completeOnboardingRequestSchema.safeParse({ ...validPayload, age: 15 })
    expect(result.success).toBe(false)
  })

  it('rechaza edad > 100', () => {
    const result = completeOnboardingRequestSchema.safeParse({ ...validPayload, age: 101 })
    expect(result.success).toBe(false)
  })

  it('rechaza dailyStudyHours > 24', () => {
    const result = completeOnboardingRequestSchema.safeParse({ ...validPayload, dailyStudyHours: 25 })
    expect(result.success).toBe(false)
  })

  it('acepta dailyStudyHours null', () => {
    const result = completeOnboardingRequestSchema.safeParse({ ...validPayload, dailyStudyHours: null })
    expect(result.success).toBe(true)
  })

  it('rechaza targetOposicion vacío', () => {
    const result = completeOnboardingRequestSchema.safeParse({ ...validPayload, targetOposicion: '' })
    expect(result.success).toBe(false)
  })
})

describe('completeOnboardingResponseSchema', () => {
  it('acepta respuesta exitosa', () => {
    const result = completeOnboardingResponseSchema.safeParse({ success: true })
    expect(result.success).toBe(true)
  })

  it('acepta respuesta con error', () => {
    const result = completeOnboardingResponseSchema.safeParse({ success: false, error: 'Algo falló' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error).toBe('Algo falló')
    }
  })

  it('rechaza sin campo success', () => {
    const result = completeOnboardingResponseSchema.safeParse({ error: 'test' })
    expect(result.success).toBe(false)
  })
})
