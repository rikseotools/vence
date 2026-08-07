// [T-163] El chat de psicotécnicos no tenía fallback de proveedor: si el elegido por
// `selectModel` (Anthropic para cálculo/series, OpenAI para el resto) fallaba con una
// excepción del SDK, la petición moría ahí. Medido en el incidente del 26/07 (saldo de
// Anthropic agotado 09:38-17:08 UTC): 21 chats enrutados a Anthropic fallaron sin
// respuesta, mientras OpenAI seguía disponible.
//
// Estos tests fijan que `processPsychometricQuestion` ahora intenta el OTRO proveedor
// antes de rendirse, en las dos direcciones, y que un fallo de los DOS sigue devolviendo
// un mensaje de error legible (nunca una excepción sin capturar).

jest.mock('@/db/client', () => ({ getDb: jest.fn() }))
jest.mock('@/db/schema', () => ({}))
jest.mock('@/lib/chat/shared/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))
jest.mock('@/lib/observability/llm', () => ({
  // Igual que el real: ejecuta la función y devuelve su resultado, sin AsyncLocalStorage
  // de verdad (no hace falta para comprobar QUÉ se llama, solo que se sigue llamando).
  runWithLlmFeature: jest.fn((_feature: string, fn: () => unknown) => fn()),
  instrumentAnthropic: jest.fn((c) => c),
  instrumentOpenai: jest.fn((c) => c),
}))

const mockAnthropicCreate = jest.fn()
const mockOpenAICreate = jest.fn()

jest.mock('@/lib/chat/shared/anthropic', () => ({
  getAnthropic: jest.fn(async () => ({ messages: { create: mockAnthropicCreate } })),
  getAnthropicModel: jest.fn(async () => 'claude-sonnet-test'),
}))
jest.mock('@/lib/chat/shared/openai', () => ({
  getOpenAI: jest.fn(async () => ({ chat: { completions: { create: mockOpenAICreate } } })),
  CHAT_MODEL: 'gpt-4o-test',
  CHAT_MODEL_PREMIUM: 'gpt-4o-test',
}))

import { processPsychometricQuestion } from '@/lib/chat/domains/psychometric/PsychometricService'
import type { ChatContext } from '@/lib/chat/core/types'

function buildContext(questionSubtype: string): ChatContext {
  return {
    request: { messages: [{ role: 'user', content: 'ayuda' }], isPremium: false },
    userId: 'user-1',
    userDomain: 'psychometric',
    isPremium: false,
    questionContext: {
      questionId: 'q-1',
      questionText: '¿Cuál es el siguiente número? 2, 4, 6, ?',
      options: ['6', '8', '10', '12'],
      correctAnswer: 1,
      isPsicotecnico: true,
      questionSubtype,
    },
    messages: [{ role: 'user', content: 'ayuda' }],
    currentMessage: 'ayuda',
  } as unknown as ChatContext
}

const anthropicOk = {
  content: [{ type: 'text', text: 'Respuesta de Claude' }],
  usage: { input_tokens: 10, output_tokens: 5 },
  stop_reason: 'end_turn',
}
const openaiOk = {
  choices: [{ message: { content: 'Respuesta de GPT' }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
}
const infraError = Object.assign(new Error('Your credit balance is too low'), { status: 400 })

beforeEach(() => {
  mockAnthropicCreate.mockReset()
  mockOpenAICreate.mockReset()
})

describe('processPsychometricQuestion — sin fallo, sin fallback', () => {
  it('subtype de cálculo (Anthropic) responde con Anthropic cuando no falla', async () => {
    mockAnthropicCreate.mockResolvedValue(anthropicOk)
    const res = await processPsychometricQuestion(buildContext('calculation'))
    expect(res.content).toBe('Respuesta de Claude')
    expect(res.metadata?.modelProvider).toBe('anthropic')
    expect(mockOpenAICreate).not.toHaveBeenCalled()
  })

  it('subtype sin razonamiento avanzado (OpenAI) responde con OpenAI cuando no falla', async () => {
    mockOpenAICreate.mockResolvedValue(openaiOk)
    const res = await processPsychometricQuestion(buildContext('analogy'))
    expect(res.content).toBe('Respuesta de GPT')
    expect(res.metadata?.modelProvider).toBe('openai')
    expect(mockAnthropicCreate).not.toHaveBeenCalled()
  })
})

describe('processPsychometricQuestion — CADENA DE RESPALDO [T-163]', () => {
  it('EL CASO DEL INCIDENTE: Anthropic cae (sin saldo) → responde con OpenAI, no con un mensaje de error', async () => {
    mockAnthropicCreate.mockRejectedValue(infraError)
    mockOpenAICreate.mockResolvedValue(openaiOk)

    const res = await processPsychometricQuestion(buildContext('calculation'))

    expect(res.content).toBe('Respuesta de GPT')
    expect(res.metadata?.modelProvider).toBe('openai')
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1)
    expect(mockOpenAICreate).toHaveBeenCalledTimes(1)
  })

  it('dirección inversa: OpenAI cae → responde con Anthropic', async () => {
    mockOpenAICreate.mockRejectedValue(infraError)
    mockAnthropicCreate.mockResolvedValue(anthropicOk)

    const res = await processPsychometricQuestion(buildContext('analogy'))

    expect(res.content).toBe('Respuesta de Claude')
    expect(res.metadata?.modelProvider).toBe('anthropic')
  })

  it('los DOS proveedores caen → mensaje de error legible, NUNCA una excepción sin capturar', async () => {
    mockAnthropicCreate.mockRejectedValue(infraError)
    mockOpenAICreate.mockRejectedValue(infraError)

    const res = await processPsychometricQuestion(buildContext('calculation'))

    expect(res.content).toMatch(/no está disponible ahora mismo/i)
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1)
    expect(mockOpenAICreate).toHaveBeenCalledTimes(1)
  })

  it('el respaldo NO se intenta si el primario responde bien (no hay llamada de más)', async () => {
    mockAnthropicCreate.mockResolvedValue(anthropicOk)
    await processPsychometricQuestion(buildContext('calculation'))
    expect(mockOpenAICreate).not.toHaveBeenCalled()
  })

  it('un fallo saturado (429) también dispara el respaldo, igual que sin saldo', async () => {
    const saturado = Object.assign(new Error('rate limited'), { status: 429 })
    mockAnthropicCreate.mockRejectedValue(saturado)
    mockOpenAICreate.mockResolvedValue(openaiOk)

    const res = await processPsychometricQuestion(buildContext('calculation'))

    expect(res.content).toBe('Respuesta de GPT')
  })
})
