import { CanaryStripeWebhookService } from './canary-stripe-webhook.service';

/**
 * La sonda firmaba solo con `STRIPE_WEBHOOK_SECRET` (cuenta Manuel), así que la
 * ruta de firma de la cuenta que recibe todas las altas nuevas no se probaba.
 * Estos tests fijan que se prueba UNA VEZ POR CUENTA y que una cuenta sin
 * signing secret sale como punto ciego, no como verde.
 */

const ORIGINAL_ENV = process.env;
const ORIGINAL_FETCH = global.fetch;

interface FetchCall {
  signature: string;
  body: string;
}

function mockFetch(handler?: (call: FetchCall) => Response) {
  const calls: FetchCall[] = [];
  global.fetch = jest.fn(
    (
      _url: unknown,
      init?: { headers?: Record<string, string>; body?: string },
    ) => {
      const call = {
        signature: init?.headers?.['Stripe-Signature'] ?? '',
        body: init?.body ?? '',
      };
      calls.push(call);
      return Promise.resolve(
        handler?.(call) ??
          new Response(JSON.stringify({ received: true }), { status: 200 }),
      );
    },
  ) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_manuel';
  process.env.STRIPE_WEBHOOK_SECRET_NILA = 'whsec_nila';
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  jest.restoreAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('CanaryStripeWebhookService (una sonda por cuenta)', () => {
  it('firma y entrega un evento por CADA cuenta configurada', async () => {
    const calls = mockFetch();
    const result = await new CanaryStripeWebhookService().run();

    expect(calls).toHaveLength(2);
    // Firmas distintas ⇒ cada una con el secret de su cuenta (si compartieran
    // secret, el fallo de firma de una cuenta pasaría inadvertido).
    expect(calls[0].signature).not.toBe(calls[1].signature);
    expect(result).toMatchObject({ ok: true, degraded: false });
    if ('accounts' in result) {
      expect(result.accounts?.map((a) => [a.account, a.probed, a.ok])).toEqual([
        ['manuel', true, true],
        ['nila', true, true],
      ]);
    }
  });

  it('falla si UNA cuenta falla, y dice cuál', async () => {
    let n = 0;
    mockFetch(() => {
      n += 1;
      return n === 2
        ? new Response('signature verification failed', { status: 400 })
        : new Response(JSON.stringify({ received: true }), { status: 200 });
    });

    const result = await new CanaryStripeWebhookService().run();

    expect(result).toMatchObject({ ok: false });
    if ('errorMessage' in result) {
      expect(result.errorMessage).toContain('nila');
      expect(result.errorMessage).toContain('400');
    }
  });

  it('cuenta sin signing secret → degraded, la otra se prueba igual', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET_NILA;
    const calls = mockFetch();

    const result = await new CanaryStripeWebhookService().run();

    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: true, degraded: true });
    if ('accounts' in result) {
      expect(result.accounts?.find((a) => a.account === 'nila')).toMatchObject({
        probed: false,
        ok: false,
      });
    }
  });

  it('sin ningún secret, el canary se declara inactivo (no verde)', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET_NILA;
    mockFetch();

    const result = await new CanaryStripeWebhookService().run();

    expect(result).toMatchObject({
      skipped: true,
      reason: 'secret_not_configured',
    });
  });

  it('exige {received:true}, no solo un 200', async () => {
    mockFetch(
      () => new Response(JSON.stringify({ ok: 'sure' }), { status: 200 }),
    );

    const result = await new CanaryStripeWebhookService().run();

    expect(result).toMatchObject({ ok: false, step: 'validate_response' });
  });
});
