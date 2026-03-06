/**
 * Tests para el barrel export de lib/api/auth/index.ts
 * Verifica que todos los exports necesarios estan disponibles
 */
import * as authModule from '../../../lib/api/auth'

describe('lib/api/auth barrel exports', () => {
  describe('schemas', () => {
    test('processCallbackRequestSchema esta exportado', () => {
      expect(authModule.processCallbackRequestSchema).toBeDefined()
      expect(typeof authModule.processCallbackRequestSchema.safeParse).toBe('function')
    })

    test('processCallbackResponseSchema esta exportado', () => {
      expect(authModule.processCallbackResponseSchema).toBeDefined()
      expect(typeof authModule.processCallbackResponseSchema.safeParse).toBe('function')
    })

    test('safeParseProcessCallbackRequest esta exportado', () => {
      expect(typeof authModule.safeParseProcessCallbackRequest).toBe('function')
    })

    test('validateProcessCallbackRequest esta exportado', () => {
      expect(typeof authModule.validateProcessCallbackRequest).toBe('function')
    })
  })

  describe('queries', () => {
    test('processAuthCallback esta exportado', () => {
      expect(typeof authModule.processAuthCallback).toBe('function')
    })
  })

  describe('funcionalidad via barrel import', () => {
    test('safeParse funciona via barrel', () => {
      const valid = authModule.safeParseProcessCallbackRequest({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        userEmail: 'test@example.com',
      })
      expect(valid.success).toBe(true)

      const invalid = authModule.safeParseProcessCallbackRequest({})
      expect(invalid.success).toBe(false)
    })

    test('schema.safeParse funciona via barrel', () => {
      const result = authModule.processCallbackRequestSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        userEmail: 'test@example.com',
        isGoogleAds: true,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.isGoogleAds).toBe(true)
      }
    })
  })
})
