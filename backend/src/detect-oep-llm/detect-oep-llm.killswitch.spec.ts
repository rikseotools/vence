import { DetectOepLlmCron } from './detect-oep-llm.cron';

/**
 * Interruptor de gasto de `detect-oep-llm` (27/07/2026).
 *
 * El sensor cuesta ~$8 por día laborable (~1.700 llamadas a Haiku, una por cada
 * oposición con seguimiento_url). Estos tests fijan la semántica del flag, que
 * es lo fácil de romper sin querer: **por defecto ENCENDIDO**, y solo la cadena
 * exacta 'false' lo apaga.
 */
describe('DetectOepLlmCron.isEnabled', () => {
  const orig = process.env.DETECT_OEP_LLM_ENABLED;
  afterEach(() => {
    if (orig === undefined) delete process.env.DETECT_OEP_LLM_ENABLED;
    else process.env.DETECT_OEP_LLM_ENABLED = orig;
  });

  it('por defecto está ENCENDIDO (sin la variable)', () => {
    delete process.env.DETECT_OEP_LLM_ENABLED;
    expect(DetectOepLlmCron.isEnabled()).toBe(true);
  });

  it("'false' lo apaga", () => {
    process.env.DETECT_OEP_LLM_ENABLED = 'false';
    expect(DetectOepLlmCron.isEnabled()).toBe(false);
  });

  it("'true' lo enciende", () => {
    process.env.DETECT_OEP_LLM_ENABLED = 'true';
    expect(DetectOepLlmCron.isEnabled()).toBe(true);
  });

  it('un valor basura NO lo apaga: apagar exige decirlo explícitamente', () => {
    // Anti-regresión: si esto fuera `=== 'true'`, una variable mal escrita
    // dejaría el radar mudo en silencio. Preferimos gastar a quedarnos ciegos.
    process.env.DETECT_OEP_LLM_ENABLED = 'no';
    expect(DetectOepLlmCron.isEnabled()).toBe(true);
    process.env.DETECT_OEP_LLM_ENABLED = '';
    expect(DetectOepLlmCron.isEnabled()).toBe(true);
  });
});
