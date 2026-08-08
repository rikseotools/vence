import { CanaryQuestionsGateService } from './canary-questions-gate.service';

/**
 * T-381 (07/08/2026): la sonda REAL (sujeto no saturado) manda `x-vence-canary` sin la cabecera
 * de reto A PROPÓSITO —está probando que el gate no le retaría a un usuario normal—, pero eso la
 * dejaba contándose en `daily_questions_served` como si fuera un opositor real (numQuestions=1,
 * jamás respondida: la firma de cosecha que persigue `npm run canary:served-rollup`). Estos
 * tests fijan que la sonda real manda la cabecera de MÉTRICAS (que exime del contador sin eximir
 * del reto) y que la sonda "exenta" (sujeto saturado) sigue mandando la de reto como siempre.
 */
describe('CanaryQuestionsGateService — cabeceras de exención según el sujeto', () => {
  const ORIGINAL = { ...process.env };
  let servicio: CanaryQuestionsGateService;

  /** Captura las cabeceras de la llamada a /api/questions/filtered; sirve el resto por defecto. */
  function simularFrontend(wouldChallenge: boolean | null) {
    const cabecerasEnviadas: Array<Record<string, string>> = [];
    global.fetch = jest.fn(async (url: unknown, init?: { headers?: Record<string, string> }) => {
      const u = String(url);
      if (u.includes('/api/security/captcha/status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            enabled: true,
            siteKeyPresent: true,
            secretPresent: true,
            flagOn: true,
            ...(wouldChallenge === null ? {} : { gate: { served: 1, threshold: 500, wouldChallenge } }),
          }),
        } as unknown as Response;
      }
      if (u.includes('/api/questions/filtered')) {
        cabecerasEnviadas.push({ ...(init?.headers ?? {}) });
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => ({ success: true, questions: [{}] }),
        } as unknown as Response;
      }
      throw new Error(`ruta no simulada: ${u}`);
    }) as unknown as typeof fetch;
    return cabecerasEnviadas;
  }

  beforeEach(() => {
    process.env.SMOKE_USER_ID = '11111111-1111-4111-8111-111111111111';
    process.env.SUPABASE_JWT_SECRET = 'secreto-de-prueba';
    process.env.CANARY_SECRET = 'un-secreto-de-canary-suficientemente-largo';
    servicio = new CanaryQuestionsGateService();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    jest.restoreAllMocks();
  });

  it('sujeto NO saturado (sondaReal): manda la cabecera de MÉTRICAS, NO la de reto', async () => {
    const cabeceras = simularFrontend(false);
    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(true);
    if ('ok' in r && r.ok) expect(r.gateAssertion).toBe('real');

    expect(cabeceras).toHaveLength(1);
    expect(cabeceras[0]['x-vence-canary']).toBe('1');
    expect(cabeceras[0]['x-vence-canary-metrics-secret']).toBe(process.env.CANARY_SECRET);
    expect(cabeceras[0]['x-vence-canary-secret']).toBeUndefined();
  });

  it('sujeto SATURADO: manda la cabecera de RETO (como antes) — la sonda se vuelve exenta, no real', async () => {
    const cabeceras = simularFrontend(true);
    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(true);
    if ('ok' in r && r.ok) expect(r.gateAssertion).toBe('omitida_sujeto_saturado');

    expect(cabeceras[0]['x-vence-canary-secret']).toBe(process.env.CANARY_SECRET);
  });

  it('veredicto no disponible: también se va exenta (de reto), no como sonda real', async () => {
    const cabeceras = simularFrontend(null);
    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(true);
    if ('ok' in r && r.ok) expect(r.gateAssertion).toBe('omitida_veredicto_no_disponible');

    expect(cabeceras[0]['x-vence-canary-secret']).toBe(process.env.CANARY_SECRET);
  });
});
