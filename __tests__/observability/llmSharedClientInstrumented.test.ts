// Integración: getAnthropic()/getOpenAI() (clientes compartidos) devuelven un cliente YA
// instrumentado → cualquier call-site del chat/OEP/verificación que los use queda observado
// sin tocar el call-site. Mockeamos SDK + config de BD; instrumentAnthropic/Openai son REALES.

const mockEmit = jest.fn()
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: (...a: unknown[]) => mockEmit(...a) }))

const mockAnthropicCreate = jest.fn(async () => ({ usage: { input_tokens: 100, output_tokens: 40 } }))
jest.mock('@anthropic-ai/sdk', () => ({ __esModule: true, default: class { messages = { create: mockAnthropicCreate } } }))

const mockOpenaiCreate = jest.fn(async () => ({ usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 } }))
jest.mock('openai', () => ({ __esModule: true, default: class { chat = { completions: { create: mockOpenaiCreate } } } }))

// getDb().select().from().where().limit() → filas de config
const mockState: { rows: unknown[] } = { rows: [] }
jest.mock('@/db/client', () => ({
  getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => mockState.rows }) }) }) }),
  getAdminDb: () => ({}),
}))

import { getAnthropic } from '@/lib/chat/shared/anthropic'
import { getOpenAI } from '@/lib/chat/shared/openai'

const flush = () => new Promise((r) => setTimeout(r, 0)) // el registro va como side-effect

beforeEach(() => {
  mockEmit.mockClear()
  mockState.rows = [{ apiKeyEncrypted: Buffer.from('sk-test').toString('base64'), defaultModel: 'claude-sonnet-4-5' }]
})

describe('clientes compartidos instrumentados (integración)', () => {
  it('getAnthropic() → messages.create registra un evento llm_call', async () => {
    const client = await getAnthropic()
    await client.messages.create({ model: 'claude-sonnet-4-5', messages: [] })
    await flush()
    expect(mockEmit).toHaveBeenCalled()
    const e = mockEmit.mock.calls[0][0]
    expect(e.eventType).toBe('llm_call')
    expect(e.metadata).toMatchObject({ provider: 'anthropic', inputTokens: 100, outputTokens: 40, ok: true })
  })

  it('getOpenAI() → chat.completions.create registra un evento llm_call', async () => {
    const client = await getOpenAI()
    await client.chat.completions.create({ model: 'gpt-4o', messages: [] })
    await flush()
    expect(mockEmit).toHaveBeenCalled()
    const e = mockEmit.mock.calls[mockEmit.mock.calls.length - 1][0]
    expect(e.eventType).toBe('llm_call')
    expect(e.metadata).toMatchObject({ provider: 'openai', inputTokens: 100, outputTokens: 40, totalTokens: 140, ok: true })
  })
})
