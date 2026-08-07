import { OepSignalsLlmService } from './oep-signals-llm.service';

/**
 * fetchViaHttp con reintento de UA (T-311).
 *
 * Medido el 06/08/2026 contra comunidad.madrid: la MISMA URL, con la UA propia
 * ('VenceBot/1.0 (+https://www.vence.es/oep-detection)') devuelve 404, y con una UA de
 * navegador devuelve 200 — sin tocar nada más (mismo host, mismo path, mismo momento). El sensor
 * `detect-notas-convocatoria` (que reusa este fetch) llevaba desde antes del 26/07 sin dejar ni
 * una nota para 3 oposiciones de Madrid por esto, sin ningún error visible más allá de un log.
 *
 * Estos tests fijan el reintento: solo se dispara cuando el primer intento falla, usa la UA
 * propia primero (no cambia el comportamiento en sitios que ya funcionan), y si los dos fallan
 * devuelve el error del PRIMERO (el que describe el fallo contra nuestra identidad habitual).
 */
const ORIGINAL_FETCH = global.fetch;

interface FetchCall {
  url: string;
  userAgent: string | undefined;
}

function mockFetch(responder: (call: FetchCall) => Response) {
  const calls: FetchCall[] = [];
  global.fetch = jest.fn(
    (url: unknown, init?: { headers?: Record<string, string> }) => {
      const call = {
        url: String(url),
        userAgent: init?.headers?.['User-Agent'],
      };
      calls.push(call);
      return Promise.resolve(responder(call));
    },
  ) as unknown as typeof fetch;
  return calls;
}

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
});

function service(): OepSignalsLlmService {
  // El constructor solo necesita AnthropicService para las llamadas LLM; fetchPageHtml no lo usa.
  return new OepSignalsLlmService({} as never);
}

describe('fetchPageHtml — reintento de UA tras fallo (T-311)', () => {
  it('caso real: 404 con UA propia, 200 con UA de navegador → se recupera con el navegador', async () => {
    const calls = mockFetch((call) =>
      call.userAgent?.startsWith('VenceBot')
        ? new Response('', { status: 404 })
        : new Response('<html>contenido real</html>', { status: 200 }),
    );

    const r = await service().fetchPageHtml(
      'https://www.comunidad.madrid/empleo/x',
      5000,
      'http',
    );

    expect(r.html).toBe('<html>contenido real</html>');
    expect(r.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[0].userAgent).toContain('VenceBot');
    expect(calls[1].userAgent).toContain('Mozilla');
  });

  it('sitio que YA funciona con la UA propia → UNA sola petición, no dos', async () => {
    const calls = mockFetch(
      () => new Response('<html>ok</html>', { status: 200 }),
    );

    const r = await service().fetchPageHtml(
      'https://example.com',
      5000,
      'http',
    );

    expect(r.html).toBe('<html>ok</html>');
    expect(calls).toHaveLength(1);
    expect(calls[0].userAgent).toContain('VenceBot');
  });

  it('los dos intentos fallan → devuelve el error del PRIMERO (describe el fallo con nuestra UA habitual)', async () => {
    mockFetch((call) =>
      call.userAgent?.startsWith('VenceBot')
        ? new Response('', { status: 404 })
        : new Response('', { status: 403 }),
    );

    const r = await service().fetchPageHtml(
      'https://bloqueado-en-los-dos.example',
      5000,
      'http',
    );

    expect(r.html).toBeNull();
    expect(r.status).toBe(404);
    expect(r.error).toBe('HTTP 404');
  });

  it('error de red (no HTTP) en el primer intento también dispara el reintento', async () => {
    let n = 0;
    global.fetch = jest.fn(() => {
      n += 1;
      if (n === 1) return Promise.reject(new Error('fetch failed: ECONNRESET'));
      return Promise.resolve(
        new Response('<html>rescatado</html>', { status: 200 }),
      );
    });

    const r = await service().fetchPageHtml(
      'https://intermitente.example',
      5000,
      'http',
    );

    expect(r.html).toBe('<html>rescatado</html>');
    expect(n).toBe(2);
  });

  it('fetcherType=headless NO pasa por este camino (usa la Lambda, no fetch nativo)', async () => {
    const calls = mockFetch(
      () => new Response('<html></html>', { status: 200 }),
    );
    const svc = service();
    // Sin credenciales/región AWS configuradas, fetchViaLambda fallará limpio (no explota) — lo
    // que importa aquí es que NO se llame a global.fetch (ese es el camino 'http').
    await svc
      .fetchPageHtml('https://algo.example', 1000, 'headless')
      .catch(() => {});
    expect(calls).toHaveLength(0);
  });
});
