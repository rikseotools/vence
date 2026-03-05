// __tests__/api/ai-chat-logs/queries.test.ts

// Mock de db/client ANTES de importar el módulo bajo test
const mockReturning = jest.fn()
const mockValues = jest.fn(() => ({ returning: mockReturning }))
const mockInsert = jest.fn(() => ({ values: mockValues }))

jest.mock('@/db/client', () => ({
  getDb: () => ({
    insert: mockInsert,
  }),
}))

jest.mock('@/db/schema', () => ({
  aiChatLogs: { id: 'id_column' },
}))

import { insertChatLog } from '@/lib/api/ai-chat-logs/queries'

describe('insertChatLog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReturning.mockResolvedValue([{ id: 'generated-id-123' }])
  })

  it('inserts successfully with all fields and returns log ID', async () => {
    const result = await insertChatLog({
      logId: '550e8400-e29b-41d4-a716-446655440000',
      userId: '550e8400-e29b-41d4-a716-446655440001',
      message: 'Explica el artículo 9',
      response: 'El artículo 9 establece que...',
      sources: ['CE Art. 9'],
      detectedLaws: ['CE'],
      tokensUsed: 150,
      questionContextId: '550e8400-e29b-41d4-a716-446655440002',
      questionContextLaw: 'CE',
      suggestionUsed: 'explicar_respuesta',
      responseTimeMs: 1200,
      hadError: false,
      userOposicion: 'auxiliar_administrativo_estado',
    })

    expect(result).toBe('generated-id-123')
    expect(mockInsert).toHaveBeenCalled()
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Explica el artículo 9',
        sourcesUsed: ['CE Art. 9'],
        detectedLaws: ['CE'],
        tokensUsed: 150,
      })
    )
  })

  it('inserts with minimal fields (only message)', async () => {
    const result = await insertChatLog({ message: 'Hola' })

    expect(result).toBe('generated-id-123')
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Hola',
        sourcesUsed: [],
        detectedLaws: [],
      })
    )
  })

  it('passes sources_used as array', async () => {
    await insertChatLog({
      message: 'Test',
      sources: ['Ley 39/2015 Art. 21', 'CE Art. 103'],
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcesUsed: ['Ley 39/2015 Art. 21', 'CE Art. 103'],
      })
    )
  })

  it('passes detected_laws as array', async () => {
    await insertChatLog({
      message: 'Test',
      detectedLaws: ['Ley 39/2015', 'CE'],
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        detectedLaws: ['Ley 39/2015', 'CE'],
      })
    )
  })

  it('passes tokens_used as number', async () => {
    await insertChatLog({
      message: 'Test',
      tokensUsed: 250,
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        tokensUsed: 250,
      })
    )
  })

  it('passes questionContextId correctly', async () => {
    const qcId = '550e8400-e29b-41d4-a716-446655440099'
    await insertChatLog({
      message: 'Test',
      questionContextId: qcId,
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        questionContextId: qcId,
      })
    )
  })

  it('truncates response_preview to 500 chars', async () => {
    const longResponse = 'A'.repeat(1000)
    await insertChatLog({
      message: 'Test',
      response: longResponse,
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        responsePreview: 'A'.repeat(500),
        fullResponse: longResponse,
      })
    )
  })

  it('uses logId as the insert ID when provided', async () => {
    const logId = '550e8400-e29b-41d4-a716-446655440000'
    await insertChatLog({
      logId,
      message: 'Test',
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: logId,
      })
    )
  })

  it('includes discrepancy fields when provided', async () => {
    await insertChatLog({
      message: 'Test',
      hadDiscrepancy: true,
      aiSuggestedAnswer: 'B',
      dbAnswer: 'C',
      reanalysisResponse: 'Reanalysis text',
    })

    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        hadDiscrepancy: true,
        aiSuggestedAnswer: 'B',
        dbAnswer: 'C',
        reanalysisResponse: 'Reanalysis text',
      })
    )
  })

  it('returns null on DB error without throwing', async () => {
    mockReturning.mockRejectedValue(new Error('Connection refused'))

    const result = await insertChatLog({ message: 'Test' })

    expect(result).toBeNull()
  })
})
