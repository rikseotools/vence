const mockEmit = jest.fn()
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: (...a: unknown[]) => mockEmit(...a) }))

import {
  normalizeUsage,
  estimateCostUsd,
  recordLlmCall,
  runWithLlmFeature,
  currentLlmFeature,
  instrumentAnthropic,
  instrumentOpenai,
} from '@/lib/observability/llm'

beforeEach(() => mockEmit.mockClear())

// El registro es un side-effect sobre la promesa (para preservar el APIPromise del SDK) → hay
// que flushear la cola de microtasks/timers antes de leer el evento.
const flush = () => new Promise((r) => setTimeout(r, 0))

function lastEvent() {
  return mockEmit.mock.calls[mockEmit.mock.calls.length - 1]?.[0]
}

describe('normalizeUsage — shape por proveedor', () => {
  it('anthropic: input_tokens/output_tokens', () => {
    expect(normalizeUsage('anthropic', { input_tokens: 1200, output_tokens: 300 }))
      .toEqual({ inputTokens: 1200, outputTokens: 300, totalTokens: 1500 })
  })
  it('openai: prompt_tokens/completion_tokens/total_tokens', () => {
    expect(normalizeUsage('openai', { prompt_tokens: 900, completion_tokens: 100, total_tokens: 1000 }))
      .toEqual({ inputTokens: 900, outputTokens: 100, totalTokens: 1000 })
  })
  it('usage ausente → ceros (no rompe)', () => {
    expect(normalizeUsage('anthropic', undefined)).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 })
  })
})

describe('estimateCostUsd — precios y heurística', () => {
  it('gpt-4o: 2.5 in / 10 out por 1M', () => {
    // 1M input + 0.5M output = 2.5 + 5 = 7.5
    expect(estimateCostUsd('gpt-4o', { inputTokens: 1_000_000, outputTokens: 500_000, totalTokens: 1_500_000 })).toBeCloseTo(7.5, 4)
  })
  it('claude-sonnet-4-5: 3 in / 15 out', () => {
    expect(estimateCostUsd('claude-sonnet-4-5-20250929', { inputTokens: 1_000_000, outputTokens: 100_000, totalTokens: 1_100_000 })).toBeCloseTo(4.5, 4)
  })
  it('modelo desconocido opus → heurística 15/75', () => {
    expect(estimateCostUsd('claude-opus-9-futuro', { inputTokens: 1_000_000, outputTokens: 0, totalTokens: 1_000_000 })).toBeCloseTo(15, 4)
  })
})

describe('recordLlmCall — emite al sink agnóstico', () => {
  it('ok=true → eventType llm_call, severity info, metadata con coste y tokens', () => {
    recordLlmCall({ provider: 'openai', model: 'gpt-4o', feature: 'chat', usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 }, durationMs: 850, ok: true })
    const e = lastEvent()
    expect(e.eventType).toBe('llm_call')
    expect(e.severity).toBe('info')
    expect(e.durationMs).toBe(850)
    expect(e.metadata).toMatchObject({ provider: 'openai', model: 'gpt-4o', feature: 'chat', inputTokens: 1000, outputTokens: 500, totalTokens: 1500, ok: true })
    expect(e.metadata.estimatedCostUsd).toBeGreaterThan(0)
  })
  it('ok=false → severity warn, coste 0, errorMessage', () => {
    recordLlmCall({ provider: 'anthropic', model: 'claude-sonnet-4-5', feature: 'oep', usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, durationMs: 30, ok: false, error: 'rate_limit' })
    const e = lastEvent()
    expect(e.severity).toBe('warn')
    expect(e.errorMessage).toBe('rate_limit')
    expect(e.metadata.estimatedCostUsd).toBe(0)
  })
})

describe('feature attribution (AsyncLocalStorage)', () => {
  it('por defecto unspecified; dentro de runWithLlmFeature toma la feature', () => {
    expect(currentLlmFeature()).toBe('unspecified')
    runWithLlmFeature('oep_signals', () => { expect(currentLlmFeature()).toBe('oep_signals') })
    expect(currentLlmFeature()).toBe('unspecified')
  })
})

describe('instrumentAnthropic — wrapper (éxito/error/streaming/idempotente/APIPromise)', () => {
  it('SIMULACIÓN respuesta real: registra provider/model/tokens y devuelve la respuesta intacta', async () => {
    const realResponse = { id: 'msg_1', content: [{ type: 'text', text: 'hola' }], usage: { input_tokens: 2200, output_tokens: 340 } }
    const client: any = { messages: { create: jest.fn(async () => realResponse) } }
    instrumentAnthropic(client)
    const res = await client.messages.create({ model: 'claude-sonnet-4-5-20250929', messages: [] })
    expect(res).toBe(realResponse) // no altera la respuesta
    await flush()
    const e = lastEvent()
    expect(e.metadata).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', inputTokens: 2200, outputTokens: 340, ok: true })
    expect(typeof e.durationMs).toBe('number')
  })
  it('error de la API → registra ok=false y RE-LANZA', async () => {
    const client: any = { messages: { create: jest.fn(async () => { throw new Error('overloaded') }) } }
    instrumentAnthropic(client)
    await expect(client.messages.create({ model: 'claude-sonnet-4-5' })).rejects.toThrow('overloaded')
    await flush()
    expect(lastEvent().metadata).toMatchObject({ ok: false, provider: 'anthropic' })
    expect(lastEvent().errorMessage).toBe('overloaded')
  })
  it('streaming → registra sin tokens (streaming:true) y devuelve el stream', async () => {
    const fakeStream = { [Symbol.asyncIterator]: () => ({}) }
    const client: any = { messages: { create: jest.fn(async () => fakeStream) } }
    instrumentAnthropic(client)
    const res = await client.messages.create({ model: 'claude-sonnet-4-5', stream: true })
    expect(res).toBe(fakeStream)
    await flush()
    expect(lastEvent().metadata).toMatchObject({ streaming: true, inputTokens: 0, ok: true })
  })
  it('idempotente: instrumentar dos veces NO duplica el registro', async () => {
    const client: any = { messages: { create: jest.fn(async () => ({ usage: { input_tokens: 1, output_tokens: 1 } })) } }
    instrumentAnthropic(client)
    instrumentAnthropic(client) // segunda vez → no-op
    await client.messages.create({ model: 'x' })
    await flush()
    expect(mockEmit).toHaveBeenCalledTimes(1)
  })
  it('PRESERVA los métodos del APIPromise (no lo envuelve en un Promise plano)', async () => {
    // El SDK real devuelve un APIPromise con métodos extra (.withResponse, .parse…). El wrapper
    // debe devolver el objeto ORIGINAL, no un Promise plano que los pierda.
    const apiPromise: any = Promise.resolve({ usage: { input_tokens: 1, output_tokens: 1 } })
    apiPromise.withResponse = () => 'sdk-helper'
    const client: any = { messages: { create: jest.fn(() => apiPromise) } }
    instrumentAnthropic(client)
    const p = client.messages.create({ model: 'x' })
    expect(typeof p.withResponse).toBe('function') // método del SDK conservado
    expect(p.withResponse()).toBe('sdk-helper')
    await p; await flush()
  })
})

describe('instrumentOpenai — wrapper (+ embeddings)', () => {
  it('SIMULACIÓN respuesta real: registra tokens de usage y devuelve intacto', async () => {
    const realResponse = { choices: [{ message: { content: 'x' } }], usage: { prompt_tokens: 5000, completion_tokens: 800, total_tokens: 5800 } }
    const client: any = { chat: { completions: { create: jest.fn(async () => realResponse) } } }
    instrumentOpenai(client)
    const res = await client.chat.completions.create({ model: 'gpt-4o', messages: [] })
    expect(res).toBe(realResponse)
    await flush()
    expect(lastEvent().metadata).toMatchObject({ provider: 'openai', model: 'gpt-4o', inputTokens: 5000, outputTokens: 800, totalTokens: 5800, ok: true })
  })
  it('EMBEDDINGS también se instrumentan (fuga F1 del review)', async () => {
    const client: any = {
      chat: { completions: { create: jest.fn(async () => ({})) } },
      embeddings: { create: jest.fn(async () => ({ data: [], usage: { prompt_tokens: 900, total_tokens: 900 } })) },
    }
    instrumentOpenai(client)
    await client.embeddings.create({ model: 'text-embedding-3-small', input: 'hola' })
    await flush()
    expect(lastEvent().metadata).toMatchObject({ provider: 'openai', model: 'text-embedding-3-small', inputTokens: 900, ok: true })
  })
  it('hereda la feature del contexto activo (capturada en la llamada)', async () => {
    const client: any = { chat: { completions: { create: jest.fn(async () => ({ usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } })) } } }
    instrumentOpenai(client)
    await runWithLlmFeature('generate_explanation', () => client.chat.completions.create({ model: 'gpt-4o' }))
    await flush()
    expect(lastEvent().metadata.feature).toBe('generate_explanation')
  })
})
