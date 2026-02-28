/**
 * Tests para admin-ai-config: schemas y queries
 */

if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  updateAiConfigRequestSchema,
  aiConfigResponseSchema,
  updateAiConfigResponseSchema,
} from '@/lib/api/admin-ai-config/schemas'

// ============================================
// SCHEMA TESTS
// ============================================

describe('Admin AI Config - Schemas', () => {
  describe('updateAiConfigRequestSchema', () => {
    it('should accept valid request with all fields', () => {
      const result = updateAiConfigRequestSchema.safeParse({
        provider: 'openai',
        apiKey: 'sk-test-123',
        defaultModel: 'gpt-4o-mini',
        isActive: true,
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with only provider', () => {
      const result = updateAiConfigRequestSchema.safeParse({
        provider: 'anthropic',
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty provider', () => {
      const result = updateAiConfigRequestSchema.safeParse({
        provider: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing provider', () => {
      const result = updateAiConfigRequestSchema.safeParse({
        apiKey: 'sk-test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('aiConfigResponseSchema', () => {
    it('should accept valid success response', () => {
      const result = aiConfigResponseSchema.safeParse({
        success: true,
        configs: [{
          provider: 'openai',
          is_active: true,
          default_model: 'gpt-4o-mini',
          available_models: [
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast', status: 'working', error: null },
          ],
          has_key: true,
          api_key_hint: '...1234',
          last_verified_at: '2025-01-01T00:00:00Z',
          last_verification_status: 'valid',
          last_error_message: null,
          model_test_results: null,
        }],
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = aiConfigResponseSchema.safeParse({
        success: false,
        error: 'Something went wrong',
      })
      expect(result.success).toBe(true)
    })
  })

  describe('updateAiConfigResponseSchema', () => {
    it('should accept success response', () => {
      const result = updateAiConfigResponseSchema.safeParse({
        success: true,
        message: 'Configuración de openai actualizada',
      })
      expect(result.success).toBe(true)
    })

    it('should accept error response', () => {
      const result = updateAiConfigResponseSchema.safeParse({
        success: false,
        error: 'Error',
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================
// QUERY TESTS
// ============================================

describe('Admin AI Config - Queries', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('getAllConfigs should return array of configs', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            orderBy: () => Promise.resolve([
              { provider: 'openai', isActive: true, defaultModel: 'gpt-4o-mini' },
              { provider: 'anthropic', isActive: false, defaultModel: null },
            ]),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiApiConfig: { provider: 'provider' },
    }))

    const { getAllConfigs } = require('@/lib/api/admin-ai-config/queries')
    const result = await getAllConfigs()
    expect(result).toHaveLength(2)
    expect(result[0].provider).toBe('openai')
  })

  it('getConfigByProvider should return config or null', async () => {
    jest.doMock('@/db/client', () => ({
      getDb: () => ({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ apiKeyEncrypted: 'dGVzdA==' }]),
            }),
          }),
        }),
      }),
    }))
    jest.doMock('@/db/schema', () => ({
      aiApiConfig: { provider: 'provider', apiKeyEncrypted: 'api_key_encrypted' },
    }))

    const { getConfigByProvider } = require('@/lib/api/admin-ai-config/queries')
    const result = await getConfigByProvider('openai')
    expect(result).not.toBeNull()
    expect(result.apiKeyEncrypted).toBe('dGVzdA==')
  })
})
