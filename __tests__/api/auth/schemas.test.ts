/**
 * Tests para schemas de validacion del auth callback v2
 */
import {
  processCallbackRequestSchema,
  processCallbackResponseSchema,
  safeParseProcessCallbackRequest,
} from '../../../lib/api/auth/schemas'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

describe('processCallbackRequestSchema', () => {
  const validRequest = {
    userId: VALID_UUID,
    userEmail: 'test@example.com',
  }

  test('request minimo valido (solo userId y userEmail)', () => {
    const result = processCallbackRequestSchema.safeParse(validRequest)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.userId).toBe(VALID_UUID)
      expect(result.data.userEmail).toBe('test@example.com')
      expect(result.data.returnUrl).toBe('/auxiliar-administrativo-estado')
      expect(result.data.isGoogleAds).toBe(false)
      expect(result.data.isMetaAds).toBe(false)
    }
  })

  test('request completo valido', () => {
    const full = {
      ...validRequest,
      fullName: 'Juan Garcia',
      avatarUrl: 'https://example.com/photo.jpg',
      returnUrl: '/tramitacion-procesal',
      oposicion: 'auxiliar_administrativo_estado',
      funnel: 'test',
      isGoogleAds: true,
      isGoogleAdsFromUrl: true,
      isMetaAds: false,
      googleParams: { gclid: 'abc123', utm_source: 'google' },
      metaParams: null,
    }
    const result = processCallbackRequestSchema.safeParse(full)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fullName).toBe('Juan Garcia')
      expect(result.data.isGoogleAds).toBe(true)
      expect(result.data.googleParams?.gclid).toBe('abc123')
    }
  })

  test('userId invalido es rechazado', () => {
    const result = processCallbackRequestSchema.safeParse({
      ...validRequest,
      userId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  test('userEmail invalido es rechazado', () => {
    const result = processCallbackRequestSchema.safeParse({
      ...validRequest,
      userEmail: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  test('userId faltante es rechazado', () => {
    const result = processCallbackRequestSchema.safeParse({
      userEmail: 'test@example.com',
    })
    expect(result.success).toBe(false)
  })

  test('userEmail faltante es rechazado', () => {
    const result = processCallbackRequestSchema.safeParse({
      userId: VALID_UUID,
    })
    expect(result.success).toBe(false)
  })

  test('fullName null es valido', () => {
    const result = processCallbackRequestSchema.safeParse({
      ...validRequest,
      fullName: null,
    })
    expect(result.success).toBe(true)
  })

  test('googleParams parciales son validos', () => {
    const result = processCallbackRequestSchema.safeParse({
      ...validRequest,
      googleParams: { gclid: 'abc', utm_source: null },
    })
    expect(result.success).toBe(true)
  })
})

describe('processCallbackResponseSchema', () => {
  test('response exitosa valida', () => {
    const result = processCallbackResponseSchema.safeParse({
      success: true,
      isNewUser: true,
      redirectUrl: '/auxiliar-administrativo-estado',
    })
    expect(result.success).toBe(true)
  })

  test('response con error valida', () => {
    const result = processCallbackResponseSchema.safeParse({
      success: false,
      isNewUser: false,
      redirectUrl: '/auxiliar-administrativo-estado',
      error: 'algo fallo',
    })
    expect(result.success).toBe(true)
  })

  test('response sin isNewUser es rechazada', () => {
    const result = processCallbackResponseSchema.safeParse({
      success: true,
      redirectUrl: '/test',
    })
    expect(result.success).toBe(false)
  })
})

describe('safeParseProcessCallbackRequest', () => {
  test('retorna success true para datos validos', () => {
    const result = safeParseProcessCallbackRequest({
      userId: VALID_UUID,
      userEmail: 'test@example.com',
    })
    expect(result.success).toBe(true)
  })

  test('retorna success false para datos invalidos', () => {
    const result = safeParseProcessCallbackRequest({
      userId: 'bad',
    })
    expect(result.success).toBe(false)
  })
})
