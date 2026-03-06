/**
 * Tests exhaustivos de edge cases para schemas del auth callback v2
 */
import {
  processCallbackRequestSchema,
  processCallbackResponseSchema,
  safeParseProcessCallbackRequest,
  validateProcessCallbackRequest,
} from '../../../lib/api/auth/schemas'

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

// ============================================
// REQUEST SCHEMA - Edge cases de campos
// ============================================

describe('processCallbackRequestSchema - edge cases', () => {
  describe('userId validation', () => {
    test('UUID v4 valido es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: '123e4567-e89b-12d3-a456-426614174000',
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(true)
    })

    test('string vacia es rechazada', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: '',
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(false)
    })

    test('UUID con mayusculas es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: '550E8400-E29B-41D4-A716-446655440000',
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(true)
    })

    test('numero como userId es rechazado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: 12345,
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(false)
    })

    test('null como userId es rechazado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: null,
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('userEmail validation', () => {
    test('email simple es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'user@gmail.com',
      })
      expect(result.success).toBe(true)
    })

    test('email con subdominio es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'user@mail.example.co.uk',
      })
      expect(result.success).toBe(true)
    })

    test('email sin @ es rechazado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'not-an-email',
      })
      expect(result.success).toBe(false)
    })

    test('email sin dominio es rechazado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'user@',
      })
      expect(result.success).toBe(false)
    })

    test('string vacia como email es rechazada', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('fullName - campo nullish', () => {
    test('string normal es aceptada', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        fullName: 'Maria Garcia Lopez',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.fullName).toBe('Maria Garcia Lopez')
    })

    test('null es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        fullName: null,
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.fullName).toBeNull()
    })

    test('undefined es aceptado (campo omitido)', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(true)
      if (result.success) expect(result.data.fullName).toBeUndefined()
    })

    test('string vacia es aceptada', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        fullName: '',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('avatarUrl - campo nullish', () => {
    test('URL valida es aceptada', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        avatarUrl: 'https://lh3.googleusercontent.com/a/photo.jpg',
      })
      expect(result.success).toBe(true)
    })

    test('null es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        avatarUrl: null,
      })
      expect(result.success).toBe(true)
    })

    test('string no-URL es aceptada (no hay .url())', () => {
      // avatarUrl es z.string().nullish(), no z.string().url().nullish()
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        avatarUrl: 'not-a-url-but-valid-string',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('returnUrl - campo con default', () => {
    test('omitido usa default', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.returnUrl).toBe('/auxiliar-administrativo-estado')
      }
    })

    test('string personalizada la preserva', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        returnUrl: '/tramitacion-procesal/test',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.returnUrl).toBe('/tramitacion-procesal/test')
      }
    })

    test('string vacia la preserva (no usa default)', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        returnUrl: '',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.returnUrl).toBe('')
      }
    })

    test('URL premium-ads es valida', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        returnUrl: '/premium-ads/checkout?start_checkout=true',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('boolean defaults', () => {
    test('isGoogleAds default a false', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isGoogleAds).toBe(false)
        expect(result.data.isGoogleAdsFromUrl).toBe(false)
        expect(result.data.isMetaAds).toBe(false)
      }
    })

    test('booleanos explicitamente true', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        isGoogleAds: true,
        isGoogleAdsFromUrl: true,
        isMetaAds: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isGoogleAds).toBe(true)
        expect(result.data.isGoogleAdsFromUrl).toBe(true)
        expect(result.data.isMetaAds).toBe(true)
      }
    })

    test('string "true" como boolean es rechazada', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        isGoogleAds: 'true',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('googleParams - objeto anidado', () => {
    test('null es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        googleParams: null,
      })
      expect(result.success).toBe(true)
    })

    test('objeto vacio es aceptado (gclid y utm_source son nullish)', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        googleParams: {},
      })
      expect(result.success).toBe(true)
    })

    test('gclid real es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        googleParams: {
          gclid: 'Cj0KCQiA2KitBhCIARIsAPPMEhJz6Xq9PxV7h',
          utm_source: 'google',
        },
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.googleParams?.gclid).toBe('Cj0KCQiA2KitBhCIARIsAPPMEhJz6Xq9PxV7h')
      }
    })

    test('solo gclid sin utm_source', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        googleParams: { gclid: 'abc123' },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('metaParams - objeto anidado', () => {
    test('null es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        metaParams: null,
      })
      expect(result.success).toBe(true)
    })

    test('fbclid real es aceptado', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        metaParams: {
          fbclid: 'IwAR3NmPqR2X8Q9v5K7_pL1x',
          utm_source: 'facebook',
        },
      })
      expect(result.success).toBe(true)
    })
  })

  describe('oposicion y funnel - nullish', () => {
    test('ambos null', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        oposicion: null,
        funnel: null,
      })
      expect(result.success).toBe(true)
    })

    test('oposicion con funnel', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        oposicion: 'auxiliar_administrativo_estado',
        funnel: 'temario_pdf',
      })
      expect(result.success).toBe(true)
    })

    test('funnel sin oposicion', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        funnel: 'test',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('campos extra son eliminados (strip behavior)', () => {
    test('campo desconocido no aparece en data', () => {
      const result = processCallbackRequestSchema.safeParse({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
        unknownField: 'should-be-stripped',
        hackAttempt: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).unknownField).toBeUndefined()
        expect((result.data as any).hackAttempt).toBeUndefined()
      }
    })
  })
})

// ============================================
// RESPONSE SCHEMA
// ============================================

describe('processCallbackResponseSchema - edge cases', () => {
  test('success true requiere isNewUser y redirectUrl', () => {
    const result = processCallbackResponseSchema.safeParse({
      success: true,
      isNewUser: true,
      redirectUrl: '/',
    })
    expect(result.success).toBe(true)
  })

  test('success false con error', () => {
    const result = processCallbackResponseSchema.safeParse({
      success: false,
      isNewUser: false,
      redirectUrl: '/',
      error: 'DB connection failed',
    })
    expect(result.success).toBe(true)
  })

  test('falta success es rechazado', () => {
    const result = processCallbackResponseSchema.safeParse({
      isNewUser: true,
      redirectUrl: '/',
    })
    expect(result.success).toBe(false)
  })

  test('falta redirectUrl es rechazado', () => {
    const result = processCallbackResponseSchema.safeParse({
      success: true,
      isNewUser: true,
    })
    expect(result.success).toBe(false)
  })

  test('error como campo opcional puede omitirse', () => {
    const result = processCallbackResponseSchema.safeParse({
      success: true,
      isNewUser: false,
      redirectUrl: '/test',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.error).toBeUndefined()
    }
  })
})

// ============================================
// VALIDATORS
// ============================================

describe('validateProcessCallbackRequest (throws)', () => {
  test('datos validos no lanza excepcion', () => {
    expect(() => {
      validateProcessCallbackRequest({
        userId: VALID_UUID,
        userEmail: 'test@example.com',
      })
    }).not.toThrow()
  })

  test('datos invalidos lanza ZodError', () => {
    expect(() => {
      validateProcessCallbackRequest({
        userId: 'not-uuid',
      })
    }).toThrow()
  })

  test('body vacio lanza ZodError', () => {
    expect(() => {
      validateProcessCallbackRequest({})
    }).toThrow()
  })

  test('null lanza error', () => {
    expect(() => {
      validateProcessCallbackRequest(null)
    }).toThrow()
  })

  test('undefined lanza error', () => {
    expect(() => {
      validateProcessCallbackRequest(undefined)
    }).toThrow()
  })
})

// ============================================
// INTEGRIDAD DE TIPOS
// ============================================

describe('integridad de tipos inferidos', () => {
  test('request parseado tiene todos los campos esperados', () => {
    const result = processCallbackRequestSchema.safeParse({
      userId: VALID_UUID,
      userEmail: 'test@example.com',
      fullName: 'Test',
      avatarUrl: 'https://photo.jpg',
      returnUrl: '/test',
      oposicion: 'aux',
      funnel: 'test',
      isGoogleAds: true,
      isGoogleAdsFromUrl: false,
      isMetaAds: false,
      googleParams: { gclid: 'x', utm_source: 'g' },
      metaParams: { fbclid: 'y', utm_source: 'f' },
    })

    expect(result.success).toBe(true)
    if (result.success) {
      const d = result.data
      // Todos los campos deben existir con tipos correctos
      expect(typeof d.userId).toBe('string')
      expect(typeof d.userEmail).toBe('string')
      expect(typeof d.fullName).toBe('string')
      expect(typeof d.avatarUrl).toBe('string')
      expect(typeof d.returnUrl).toBe('string')
      expect(typeof d.oposicion).toBe('string')
      expect(typeof d.funnel).toBe('string')
      expect(typeof d.isGoogleAds).toBe('boolean')
      expect(typeof d.isGoogleAdsFromUrl).toBe('boolean')
      expect(typeof d.isMetaAds).toBe('boolean')
      expect(typeof d.googleParams).toBe('object')
      expect(typeof d.metaParams).toBe('object')
    }
  })
})
