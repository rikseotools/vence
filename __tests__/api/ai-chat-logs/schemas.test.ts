// __tests__/api/ai-chat-logs/schemas.test.ts
import { insertChatLogSchema } from '@/lib/api/ai-chat-logs/schemas'

describe('insertChatLogSchema', () => {
  it('validates complete valid input', () => {
    const input = {
      logId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      message: 'Explica el artículo 9',
      response: 'El artículo 9 establece...',
      sources: ['CE Art. 9'],
      detectedLaws: ['CE'],
      tokensUsed: 150,
      questionContextId: '550e8400-e29b-41d4-a716-446655440002',
      questionContextLaw: 'Constitución Española',
      suggestionUsed: 'explicar_respuesta',
      responseTimeMs: 1200,
      hadError: false,
      errorMessage: null,
      userOposicion: 'auxiliar_administrativo_estado',
      hadDiscrepancy: false,
      aiSuggestedAnswer: null,
      dbAnswer: null,
      reanalysisResponse: null,
    }

    const result = insertChatLogSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('validates minimal valid input', () => {
    const input = { message: 'Hola' }

    const result = insertChatLogSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.sources).toEqual([])
      expect(result.data.detectedLaws).toEqual([])
      expect(result.data.hadError).toBe(false)
    }
  })

  it('defaults sources to empty array', () => {
    const input = { message: 'Test' }
    const result = insertChatLogSchema.parse(input)
    expect(result.sources).toEqual([])
  })

  it('defaults detectedLaws to empty array', () => {
    const input = { message: 'Test' }
    const result = insertChatLogSchema.parse(input)
    expect(result.detectedLaws).toEqual([])
  })

  it('rejects empty message', () => {
    const input = { message: '' }
    const result = insertChatLogSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('requires tokensUsed to be integer', () => {
    const input = { message: 'Test', tokensUsed: 1.5 }
    const result = insertChatLogSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})
