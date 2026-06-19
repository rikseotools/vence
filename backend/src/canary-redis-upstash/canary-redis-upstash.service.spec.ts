// Canary de caché (agnóstica): prueba el proveedor ACTIVO con SET+GET+verify.
// Mockeamos createCacheSink → sin red.
import type { CacheSink } from '../cache/cache-sink';

let sinkToReturn: CacheSink | null;
jest.mock('../cache/cache-sink', () => ({
  createCacheSink: () => sinkToReturn,
}));

import { CanaryRedisUpstashService } from './canary-redis-upstash.service';

// Sink fake en memoria.
function memorySink(overrides: Partial<CacheSink> = {}): CacheSink {
  const store = new Map<string, unknown>();
  return {
    name: 'fake',
    get: async <T>(k: string) => (store.has(k) ? (store.get(k) as T) : null),
    set: async <T>(k: string, v: T) => { store.set(k, v); },
    del: async (ks: string[]) => { ks.forEach((k) => store.delete(k)); },
    incr: async () => 0,
    ...overrides,
  };
}

const cfg = { get: (k: string) => (k === 'CACHE_PROVIDER' ? 'elasticache' : 'x') } as never;

describe('CanaryRedisUpstashService (agnóstica)', () => {
  beforeEach(() => { jest.clearAllMocks(); sinkToReturn = memorySink(); });

  it('SET+GET+verify OK → ok:true con provider', async () => {
    const svc = new CanaryRedisUpstashService(cfg);
    const r = await svc.run();
    expect(r).toMatchObject({ ok: true, provider: 'elasticache' });
  });

  it('sin sink (sin credenciales) → skipped', async () => {
    sinkToReturn = null;
    const svc = new CanaryRedisUpstashService(cfg);
    const r = await svc.run();
    expect(r).toMatchObject({ skipped: true, reason: 'credentials_not_configured' });
  });

  it('SET falla → ok:false step set', async () => {
    sinkToReturn = memorySink({ set: async () => { throw new Error('conn refused'); } });
    const svc = new CanaryRedisUpstashService(cfg);
    const r = await svc.run();
    expect(r).toMatchObject({ ok: false, step: 'set', provider: 'elasticache' });
  });

  it('GET devuelve valor distinto → ok:false step validate (corrupción)', async () => {
    sinkToReturn = memorySink({ get: async () => 'valor-corrupto' as never });
    const svc = new CanaryRedisUpstashService(cfg);
    const r = await svc.run();
    expect(r).toMatchObject({ ok: false, step: 'validate' });
  });

  it('GET falla → ok:false step get', async () => {
    sinkToReturn = memorySink({ get: async () => { throw new Error('timeout'); } });
    const svc = new CanaryRedisUpstashService(cfg);
    const r = await svc.run();
    expect(r).toMatchObject({ ok: false, step: 'get' });
  });
});
