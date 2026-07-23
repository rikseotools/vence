import {
  normalizeUsage,
  estimateCostUsd,
  instrumentAnthropicClient,
  enterLlmFeature,
  runWithLlmFeature,
  currentLlmFeature,
} from './llm-usage';

const flush = () => new Promise((r) => setImmediate(r)); // registro va como side-effect

describe('backend llm-usage — normalización y coste (espejo del frontend)', () => {
  it('normalizeUsage anthropic', () => {
    expect(normalizeUsage('anthropic', { input_tokens: 100, output_tokens: 20 })).toEqual({ inputTokens: 100, outputTokens: 20, totalTokens: 120 });
  });
  it('estimateCostUsd claude-sonnet', () => {
    expect(estimateCostUsd('claude-sonnet-4-5-20250929', { inputTokens: 1_000_000, outputTokens: 100_000, totalTokens: 1_100_000 })).toBeCloseTo(4.5, 4);
  });
});

describe('feature attribution backend', () => {
  it('enterLlmFeature / runWithLlmFeature', () => {
    expect(currentLlmFeature()).toBe('unspecified');
    runWithLlmFeature('oep_signals', () => expect(currentLlmFeature()).toBe('oep_signals'));
  });
});

describe('instrumentAnthropicClient — registra vía ObservabilityService', () => {
  it('messages.create emite llm_call con tokens/coste y devuelve la respuesta intacta', async () => {
    const emitFireAndForget = jest.fn();
    const obs = { emitFireAndForget } as any;
    const realResponse = { content: [{ text: 'x' }], usage: { input_tokens: 3000, output_tokens: 500 } };
    const client: any = { messages: { create: jest.fn(async () => realResponse) } };
    instrumentAnthropicClient(client, obs);

    const res = await client.messages.create({ model: 'claude-sonnet-4-5-20250929', messages: [] });
    expect(res).toBe(realResponse);
    await flush();

    expect(emitFireAndForget).toHaveBeenCalledTimes(1);
    const e = emitFireAndForget.mock.calls[0][0];
    expect(e.eventType).toBe('llm_call');
    expect(e.metadata).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet-4-5-20250929', inputTokens: 3000, outputTokens: 500, ok: true });
    expect(e.metadata.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('error → registra ok=false y RE-LANZA', async () => {
    const emitFireAndForget = jest.fn();
    const client: any = { messages: { create: jest.fn(async () => { throw new Error('overloaded'); }) } };
    instrumentAnthropicClient(client, { emitFireAndForget } as any);
    await expect(client.messages.create({ model: 'x' })).rejects.toThrow('overloaded');
    await flush();
    expect(emitFireAndForget.mock.calls[0][0].metadata).toMatchObject({ ok: false });
  });

  it('idempotente: instrumentar dos veces no duplica', async () => {
    const emitFireAndForget = jest.fn();
    const obs = { emitFireAndForget } as any;
    const client: any = { messages: { create: jest.fn(async () => ({ usage: { input_tokens: 1, output_tokens: 1 } })) } };
    instrumentAnthropicClient(client, obs);
    instrumentAnthropicClient(client, obs);
    await client.messages.create({ model: 'x' });
    await flush();
    expect(emitFireAndForget).toHaveBeenCalledTimes(1);
  });

  it('hereda la feature del contexto (oep_signals)', async () => {
    const emitFireAndForget = jest.fn();
    const client: any = { messages: { create: jest.fn(async () => ({ usage: { input_tokens: 1, output_tokens: 1 } })) } };
    instrumentAnthropicClient(client, { emitFireAndForget } as any);
    await runWithLlmFeature('oep_signals', () => client.messages.create({ model: 'x' }));
    await flush();
    expect(emitFireAndForget.mock.calls[0][0].metadata.feature).toBe('oep_signals');
  });
});
