import {
  ALL_STRIPE_ACCOUNTS,
  getStripeAccountKeys,
  getStripeWebhookSecrets,
} from './stripe-accounts';

/**
 * Registro de cuentas del backend. Lo comparten check-webhook-health,
 * subscription-reconciliation y el canary del webhook: si esta lista se queda
 * corta, esas tres vigilancias dejan de mirar una cuenta EN SILENCIO — que es
 * exactamente el fallo del 29/07/2026.
 */
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe('ALL_STRIPE_ACCOUNTS', () => {
  it('conoce las dos cuentas en explotación', () => {
    expect(ALL_STRIPE_ACCOUNTS).toEqual(['manuel', 'nila']);
  });
});

describe('getStripeAccountKeys', () => {
  it('devuelve la key de cada cuenta desde su env', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_m';
    process.env.STRIPE_SECRET_KEY_NILA = 'sk_n';
    expect(getStripeAccountKeys()).toEqual([
      { account: 'manuel', envVar: 'STRIPE_SECRET_KEY', secretKey: 'sk_m' },
      { account: 'nila', envVar: 'STRIPE_SECRET_KEY_NILA', secretKey: 'sk_n' },
    ]);
  });

  it('devuelve la cuenta NO configurada con secretKey null, no la omite', () => {
    // Omitirla convertiría un punto ciego en un verde: el llamante no podría
    // distinguir "la miré y está bien" de "no la he mirado".
    process.env.STRIPE_SECRET_KEY = 'sk_m';
    delete process.env.STRIPE_SECRET_KEY_NILA;
    const keys = getStripeAccountKeys();
    expect(keys).toHaveLength(2);
    expect(keys.find((k) => k.account === 'nila')).toMatchObject({
      secretKey: null,
    });
  });

  it('acepta un env inyectado (tests sin tocar process.env)', () => {
    expect(getStripeAccountKeys({ STRIPE_SECRET_KEY: 'x' })).toEqual([
      { account: 'manuel', envVar: 'STRIPE_SECRET_KEY', secretKey: 'x' },
      { account: 'nila', envVar: 'STRIPE_SECRET_KEY_NILA', secretKey: null },
    ]);
  });
});

describe('getStripeWebhookSecrets', () => {
  it('son secrets DISTINTOS de las secret keys (cada cuenta firma con el suyo)', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_m';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_m';
    process.env.STRIPE_WEBHOOK_SECRET_NILA = 'whsec_n';
    const secrets = getStripeWebhookSecrets();
    expect(secrets.map((s) => [s.account, s.secret])).toEqual([
      ['manuel', 'whsec_m'],
      ['nila', 'whsec_n'],
    ]);
    expect(secrets.every((s) => s.secret !== 'sk_m')).toBe(true);
  });

  it('marca con null la cuenta sin signing secret (sonda ausente)', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_m';
    delete process.env.STRIPE_WEBHOOK_SECRET_NILA;
    expect(
      getStripeWebhookSecrets().find((s) => s.account === 'nila'),
    ).toMatchObject({
      secret: null,
      envVar: 'STRIPE_WEBHOOK_SECRET_NILA',
    });
  });
});
