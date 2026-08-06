import { OepSignalsLlmService } from './oep-signals-llm.service';

/**
 * T-237 (06/08/2026): las 4 llamadas de `oep-signals-llm.service.ts` a
 * `client.messages.create()` no pasaban `timeout`, así que corrían con el default del SDK de
 * Anthropic — 10 minutos, con reintento automático. Medido contra `observable_events` (30 días,
 * feature='oep_signals', 3.050 llamadas reales): p99=7,2s, máximo observado=24,8s — el default
 * dejaba ~24× de margen antes de considerarse "colgada". `detect-oep-llm` recorre ~2.200
 * oposiciones EN SECUENCIA: unas pocas llamadas atascadas bastan para inflar la pasada entera
 * más allá del presupuesto del cron. Este guardarraíl fija que las 4 pasan un timeout acotado.
 */
describe('OepSignalsLlmService — las 4 llamadas al LLM llevan timeout acotado', () => {
  function buildService(createImpl: () => Promise<unknown>) {
    // Tipado con 2 parámetros a propósito (aunque el mock los ignore): así
    // `create.mock.calls[0]` se tipa como tupla de 2 y `const [, opts] = ...` compila.
    const create = jest
      .fn<Promise<unknown>, [unknown, { timeout: number }?]>()
      .mockImplementation(createImpl);
    const client = { messages: { create } };
    const anthropic = { getClient: async () => client } as any;
    const service = new OepSignalsLlmService(anthropic);
    return { service, create };
  }

  const htmlLargoDeMas = 'x'.repeat(300);

  it('extractOepFromHtml pasa timeout de 60s (no el default de 10min del SDK)', async () => {
    const { service, create } = buildService(async () => ({
      content: [{ type: 'text', text: '{}' }],
    }));
    await service.extractOepFromHtml(htmlLargoDeMas, 'contexto');
    expect(create).toHaveBeenCalledTimes(1);
    const [, opts] = create.mock.calls[0];
    expect(opts).toEqual({ timeout: 60_000 });
  });

  it('extractRegionalOeps pasa timeout de 60s', async () => {
    const { service, create } = buildService(async () => ({
      content: [{ type: 'text', text: '{}' }],
    }));
    await service.extractRegionalOeps(htmlLargoDeMas, 'C. Valenciana');
    expect(create).toHaveBeenCalledTimes(1);
    const [, opts] = create.mock.calls[0];
    expect(opts).toEqual({ timeout: 60_000 });
  });

  it('extractTemarioChanges pasa timeout de 60s', async () => {
    const { service, create } = buildService(async () => ({
      content: [{ type: 'text', text: '{}' }],
    }));
    await service.extractTemarioChanges(
      'candidato de al menos veinte caracteres',
      'Murcia',
    );
    expect(create).toHaveBeenCalledTimes(1);
    const [, opts] = create.mock.calls[0];
    expect(opts).toEqual({ timeout: 60_000 });
  });

  it('extractGenericSourceChanges pasa timeout de 60s', async () => {
    const { service, create } = buildService(async () => ({
      content: [{ type: 'text', text: '{}' }],
    }));
    await service.extractGenericSourceChanges('Fuente X', htmlLargoDeMas, null);
    expect(create).toHaveBeenCalledTimes(1);
    const [, opts] = create.mock.calls[0];
    expect(opts).toEqual({ timeout: 60_000 });
  });

  // Mutation-check: si alguien vuelve a llamar sin el segundo argumento, este test lo caza —
  // demostrado revirtiendo el fix a mano y confirmando que las 4 fallan (ver entrega T-237).
  it('el texto demasiado corto NO llega a llamar al LLM (guard previo intacto)', async () => {
    const { service, create } = buildService(async () => ({ content: [] }));
    const out = await service.extractOepFromHtml('corto', 'contexto');
    expect(out).toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});
