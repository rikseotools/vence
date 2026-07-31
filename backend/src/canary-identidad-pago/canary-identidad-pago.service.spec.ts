import { CanaryIdentidadPagoService } from './canary-identidad-pago.service';

/**
 * Un canary que no puede dar rojo no vigila nada. Esto comprueba que da rojo cuando toca —y
 * solo cuando toca— simulando las respuestas del frontend.
 *
 * El caso que más importa es el penúltimo: **una sesión inválida no puede leerse como verde.**
 * La sonda del checkout solo exige «cualquier cosa menos 403», así que un token caducado (401
 * en todo) la pasaría de largo. Ése es exactamente el defecto que T-280 encontró en el canary
 * del gate: se eximía a sí mismo y llevaba meses pasando sin medir.
 */
describe('CanaryIdentidadPagoService', () => {
  const ORIGINAL = { ...process.env };
  let servicio: CanaryIdentidadPagoService;

  /** Respuestas por ruta, en el orden en que las pide el canary. */
  function simularFrontend(respuestas: {
    subscription?: { status: number; body?: unknown };
    checkout?: number;
    cancel?: number;
  }) {
    global.fetch = jest.fn(async (url: unknown, init?: { method?: string }) => {
      const u = String(url);
      if (u.includes('/api/stripe/subscription')) {
        const r = respuestas.subscription ?? { status: 200, body: { hasSubscription: false } };
        return { status: r.status, json: async () => r.body ?? {} } as unknown as Response;
      }
      if (u.includes('/api/stripe/create-checkout')) {
        return { status: respuestas.checkout ?? 400 } as unknown as Response;
      }
      if (u.includes('/api/stripe/cancel')) {
        return { status: respuestas.cancel ?? 403 } as unknown as Response;
      }
      throw new Error(`ruta no simulada: ${u} (${init?.method})`);
    }) as unknown as typeof fetch;
  }

  beforeEach(() => {
    process.env.SMOKE_USER_ID = '11111111-1111-4111-8111-111111111111';
    process.env.SUPABASE_JWT_SECRET = 'secreto-de-prueba';
    servicio = new CanaryIdentidadPagoService();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
    jest.restoreAllMocks();
  });

  it('sin credenciales se declara inactivo, no verde', async () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const r = await new CanaryIdentidadPagoService().run();
    expect('skipped' in r && r.skipped).toBe(true);
  });

  it('camino sano: el checkout no corta y cancelar sí → verde con la aserción hecha', async () => {
    simularFrontend({ checkout: 400, cancel: 403 });
    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(true);
    if ('ok' in r && r.ok) expect(r.cancelAssertion).toBe('real');
  });

  it('REGRESIÓN: el checkout vuelve a cortar con 403 → rojo', async () => {
    simularFrontend({ checkout: 403 });
    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(false);
    if ('ok' in r && !r.ok) expect(r.step).toBe('checkout_cerrado');
  });

  it('REGRESIÓN GRAVE: cancelar acepta un id ajeno → rojo', async () => {
    simularFrontend({ checkout: 400, cancel: 200 });
    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(false);
    if ('ok' in r && !r.ok) expect(r.step).toBe('cancel_abierto');
  });

  it('si el sujeto TIENE suscripción, la sonda destructiva se omite y se dice', async () => {
    // Nunca se arriesga a cancelar de verdad: mejor un «hoy no lo he comprobado» que un
    // canary que puede romper lo que vigila.
    const fetchSpy = jest.fn();
    simularFrontend({ subscription: { status: 200, body: { hasSubscription: true } }, checkout: 400 });
    const original = global.fetch as jest.Mock;
    global.fetch = ((...a: unknown[]) => {
      fetchSpy(String(a[0]));
      return original(...(a as [unknown, unknown]));
    }) as unknown as typeof fetch;

    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(true);
    if ('ok' in r && r.ok) expect(r.cancelAssertion).toBe('omitida_sujeto_con_suscripcion');
    expect(fetchSpy.mock.calls.some(([u]) => String(u).includes('/api/stripe/cancel'))).toBe(false);
  });

  it('una sesión que no vale NO se lee como verde (el defecto de T-280)', async () => {
    // Con 401 en todo, la sonda del checkout («cualquier cosa menos 403») pasaría sola.
    simularFrontend({ subscription: { status: 401 }, checkout: 401, cancel: 401 });
    const r = await servicio.run();
    expect('ok' in r && r.ok).toBe(false);
    if ('ok' in r && !r.ok) expect(r.step).toBe('sesion_inutil');
  });

  it('no afirma ser una persona real: el id ajeno es un UUID de nadie', async () => {
    const cuerpos: string[] = [];
    global.fetch = jest.fn(async (url: unknown, init?: { body?: string }) => {
      if (init?.body) cuerpos.push(init.body);
      if (String(url).includes('/api/stripe/subscription')) {
        return { status: 200, json: async () => ({ hasSubscription: false }) } as unknown as Response;
      }
      return { status: String(url).includes('cancel') ? 403 : 400 } as unknown as Response;
    }) as unknown as typeof fetch;

    await servicio.run();
    // Un id de una persona real dejaría su UUID en los eventos de identidad ajena y
    // ensuciaría cualquier investigación posterior.
    expect(cuerpos.every((b) => b.includes('00000000-0000-4000-8000-000000000000'))).toBe(true);
  });
});
