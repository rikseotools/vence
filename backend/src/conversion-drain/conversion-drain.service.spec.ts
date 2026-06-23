import { ConfigService } from '@nestjs/config';
import { ConversionDrainService } from './conversion-drain.service';

/**
 * El servicio dispara el endpoint de drain de forma fiable desde el worker
 * Fargate. Verificamos: auth Bearer, mapeo del summary, y que un fallo de
 * red/HTTP NO lanza (es reintentable: el endpoint es idempotente por order_id).
 */
describe('ConversionDrainService', () => {
  const makeConfig = (overrides: Record<string, string> = {}) => {
    const env: Record<string, string> = {
      APP_BASE_URL: 'https://www.vence.es',
      CRON_SECRET: 'tok',
      ...overrides,
    };
    return { get: (k: string) => env[k] } as unknown as ConfigService;
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('dispara el endpoint con Bearer y mapea el summary en éxito', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ scanned: 3, delivered: 2, retried: 1, dlq: 0, skipped: 0, validated: 0 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );

    const svc = new ConversionDrainService(makeConfig());
    const res = await svc.run();

    expect(res.ok).toBe(true);
    expect(res.delivered).toBe(2);
    expect(res.retried).toBe(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://www.vence.es/api/cron/conversion-outbox');
    expect(new Headers(init!.headers).get('authorization')).toBe('Bearer tok');
  });

  it('marca dlq>0 sin lanzar (lo señala el cron como warn)', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ scanned: 1, delivered: 0, retried: 0, dlq: 1 }), { status: 200 }),
    );
    const res = await new ConversionDrainService(makeConfig()).run();
    expect(res.ok).toBe(true);
    expect(res.dlq).toBe(1);
  });

  it('HTTP no-2xx → ok=false con status, sin lanzar', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const res = await new ConversionDrainService(makeConfig()).run();
    expect(res.ok).toBe(false);
    expect(res.httpStatus).toBe(401);
  });

  it('fallo de red → ok=false reintentable, sin lanzar', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('fetch failed'));
    const res = await new ConversionDrainService(makeConfig()).run();
    expect(res.ok).toBe(false);
    expect(res.httpStatus).toBeNull();
    expect(res.errorMessage).toContain('fetch failed');
  });

  it('sin CRON_SECRET → skip explícito, no llama a fetch', async () => {
    const fetchMock = jest.spyOn(global, 'fetch');
    const res = await new ConversionDrainService(makeConfig({ CRON_SECRET: '' })).run();
    expect(res.ok).toBe(false);
    expect(res.skippedReason).toBe('cron_secret_missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
