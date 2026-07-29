import {
  CheckWebhookHealthService,
  type StripeEventLite,
} from './check-webhook-health.service';

/**
 * Regresión 29/07/2026: el cron leía SOLO `STRIPE_SECRET_KEY` (cuenta Manuel).
 * Con las altas nuevas en la cuenta Nila, el webhook de Nila podía estar caído
 * al 100% y este cron seguía diciendo "sano". Estos tests fijan que:
 *   · cada cuenta se evalúa por separado (agregar diluye el fallo de la pequeña)
 *   · una cuenta sin key / ilegible sale como degraded, nunca como verde
 */

const ev = (id: string, pending: number, created: number): StripeEventLite => ({
  id,
  type: 'invoice.paid',
  created,
  pending_webhooks: pending,
});

const NOW = Math.floor(Date.now() / 1000);

/** Servicio con la llamada a Stripe sustituida por páginas en memoria. */
class FakeService extends CheckWebhookHealthService {
  constructor(
    private readonly pages: Record<
      string,
      Array<{ data: StripeEventLite[]; has_more: boolean }> | Error
    >,
  ) {
    super();
  }

  public calls: string[] = [];
  private cursor: Record<string, number> = {};

  protected listEvents(secretKey: string) {
    this.calls.push(secretKey);
    const pages = this.pages[secretKey];
    if (pages instanceof Error) return Promise.reject(pages);
    if (!pages) return Promise.resolve({ data: [], has_more: false });
    const i = this.cursor[secretKey] ?? 0;
    this.cursor[secretKey] = i + 1;
    return Promise.resolve(pages[i] ?? { data: [], has_more: false });
  }
}

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.STRIPE_SECRET_KEY = 'sk_manuel';
  process.env.STRIPE_SECRET_KEY_NILA = 'sk_nila';
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('CheckWebhookHealthService (multi-cuenta)', () => {
  it('mira TODAS las cuentas configuradas, no solo la histórica', async () => {
    const svc = new FakeService({
      sk_manuel: [{ data: [ev('e1', 0, NOW)], has_more: false }],
      sk_nila: [{ data: [ev('e2', 0, NOW)], has_more: false }],
    });
    const r = await svc.run();
    expect(svc.calls.sort()).toEqual(['sk_manuel', 'sk_nila']);
    expect(r.accounts.map((a) => a.account)).toEqual(['manuel', 'nila']);
    expect(r.healthy).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.totalEvents).toBe(2);
  });

  it('marca unhealthy la cuenta pequeña aunque el agregado quede bajo el umbral', async () => {
    // 100 eventos sanos en manuel + 5 eventos TODOS pending en nila.
    // Agregado: 5/105 = 4,8% (bajo el umbral del 10%) → el modelo viejo decía
    // "sano" mientras el webhook de Nila estaba roto al 100%.
    const manuel = Array.from({ length: 100 }, (_, i) => ev(`m${i}`, 0, NOW));
    const nila = Array.from({ length: 5 }, (_, i) => ev(`n${i}`, 1, NOW - 600));
    const svc = new FakeService({
      sk_manuel: [{ data: manuel, has_more: false }],
      sk_nila: [{ data: nila, has_more: false }],
    });

    const r = await svc.run();

    expect(r.pendingPct).toBeLessThan(r.thresholdPct); // el agregado NO delata
    expect(r.healthy).toBe(false); // pero la cuenta sí
    expect(r.unhealthyAccounts).toEqual(['nila']);
    expect(r.accounts.find((a) => a.account === 'manuel')?.healthy).toBe(true);
    expect(r.accounts.find((a) => a.account === 'nila')?.pendingPct).toBe(100);
  });

  it('una cuenta conocida SIN secret key sale degraded, no verde', async () => {
    delete process.env.STRIPE_SECRET_KEY_NILA;
    const svc = new FakeService({
      sk_manuel: [{ data: [ev('e1', 0, NOW)], has_more: false }],
    });

    const r = await svc.run();

    expect(r.healthy).toBe(true); // lo legible está bien
    expect(r.degraded).toBe(true); // pero hay un punto ciego
    const nila = r.accounts.find((a) => a.account === 'nila');
    expect(nila).toMatchObject({ readable: false, healthy: false });
    expect(nila?.error).toContain('STRIPE_SECRET_KEY_NILA');
  });

  it('un error de la API de una cuenta no tumba el chequeo de la otra', async () => {
    const svc = new FakeService({
      sk_manuel: [{ data: [ev('e1', 0, NOW)], has_more: false }],
      sk_nila: new Error('Invalid API Key'),
    });

    const r = await svc.run();

    expect(r.degraded).toBe(true);
    expect(r.accounts.find((a) => a.account === 'manuel')?.readable).toBe(true);
    expect(r.accounts.find((a) => a.account === 'nila')).toMatchObject({
      readable: false,
      error: 'Invalid API Key',
    });
  });

  it('lanza solo si NINGUNA cuenta está configurada', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY_NILA;
    await expect(new FakeService({}).run()).rejects.toThrow(
      /Ninguna cuenta Stripe configurada/,
    );
  });

  it('ignora eventos fuera de la ventana de 1h y corta la paginación', async () => {
    const svc = new FakeService({
      sk_manuel: [
        { data: [ev('reciente', 1, NOW - 60)], has_more: true },
        { data: [ev('viejo', 1, NOW - 7200)], has_more: true },
      ],
      sk_nila: [{ data: [], has_more: false }],
    });

    const r = await svc.run();

    const manuel = r.accounts.find((a) => a.account === 'manuel');
    expect(manuel?.totalEvents).toBe(1); // el viejo no cuenta
    expect(manuel?.pendingEvents).toBe(1);
    expect(svc.calls.filter((c) => c === 'sk_manuel')).toHaveLength(2); // cortó
  });

  it('reporta el pending más antiguo entre todas las cuentas', async () => {
    const svc = new FakeService({
      sk_manuel: [{ data: [ev('m1', 1, NOW - 300)], has_more: false }],
      sk_nila: [{ data: [ev('n1', 1, NOW - 1800)], has_more: false }],
    });

    const r = await svc.run();

    expect(r.oldestPendingAgeS).toBeGreaterThanOrEqual(1800);
    expect(r.unhealthyAccounts.sort()).toEqual(['manuel', 'nila']);
  });
});
