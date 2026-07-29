import type { SQL } from 'drizzle-orm';
import { SubscriptionReconciliationService } from './subscription-reconciliation.service';

/**
 * Pass-2 es la red de rescate de los pagos que el webhook perdió: escribe sobre
 * el premium y la cuenta de cobro de un usuario real. Estos tests cubren la
 * ORQUESTACIÓN (las decisiones puras están en pass2-matching.spec.ts):
 *
 *   · recorre TODAS las cuentas Stripe, no solo la histórica (29/07/2026)
 *   · rescata al re-comprador aunque el customer del perfil sea el de la
 *     cuenta vieja — el caso que el match por customer_id NO resuelve
 *   · repara el perfil ENTERO (premium + customer + payment_account)
 *   · una cuenta ciega es `degraded`, no un "0 pendientes"
 */

/**
 * Renderiza el SQL de Drizzle a texto (con valores) para poder enrutar en el
 * fake. Recursivo: las sentencias condicionales del servicio anidan SQL dentro
 * de SQL (`${cond ? 'premium' : sql`plan_type`}`).
 */
function render(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] })?.queryChunks;
  if (!Array.isArray(chunks)) return '';
  return chunks
    .map((c): string => {
      if (c === null || c === undefined) return '';
      if (typeof c === 'string') return c;
      if (Array.isArray((c as { queryChunks?: unknown[] }).queryChunks))
        return render(c);
      return scalar((c as { value?: unknown }).value);
    })
    .join('');
}

/** Solo escalares y arrays de escalares: nada de `[object Object]` en el texto. */
function scalar(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map(scalar).join('');
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

interface FakeDbOptions {
  /** subs (por id) que YA están en user_subscriptions */
  subsInDb?: string[];
  /** user_id que devuelve la búsqueda por metadata */
  profileById?: string | null;
  /** user_id que devuelve la búsqueda por stripe_customer_id */
  profileByCustomer?: string | null;
  /** user_id que devuelve la búsqueda por email */
  profileByEmail?: string | null;
  /** estado actual del perfil que se lee dentro de la transacción */
  profileState?: {
    id: string;
    email: string | null;
    plan_type: string | null;
    stripe_customer_id: string | null;
    payment_account: string | null;
  };
}

class FakeDb {
  public writes: string[] = [];
  public queries: string[] = [];
  constructor(private readonly opts: FakeDbOptions = {}) {}

  execute(query: SQL): Promise<unknown[]> {
    const text = render(query);
    this.queries.push(text);

    if (
      /INSERT INTO user_subscriptions/i.test(text) ||
      /UPDATE user_profiles SET/i.test(text)
    ) {
      this.writes.push(text);
      return Promise.resolve([]);
    }
    // Pass-1
    if (/INNER JOIN user_profiles/i.test(text)) return Promise.resolve([]);
    // ¿la sub ya está en BD?
    if (/FROM user_subscriptions/i.test(text)) {
      const id = /stripe_subscription_id = (\S+)/.exec(text)?.[1];
      const hit = (this.opts.subsInDb ?? []).includes(id ?? '');
      return Promise.resolve(hit ? [{ id: 'row' }] : []);
    }
    // estado del perfil dentro de la transacción
    if (/SELECT id, email, plan_type/i.test(text)) {
      return Promise.resolve(
        this.opts.profileState ? [this.opts.profileState] : [],
      );
    }
    if (/lower\(email\)/i.test(text)) {
      return Promise.resolve(
        this.opts.profileByEmail ? [{ id: this.opts.profileByEmail }] : [],
      );
    }
    if (/WHERE stripe_customer_id/i.test(text)) {
      return Promise.resolve(
        this.opts.profileByCustomer
          ? [{ id: this.opts.profileByCustomer }]
          : [],
      );
    }
    if (/FROM user_profiles WHERE id =/i.test(text)) {
      return Promise.resolve(
        this.opts.profileById ? [{ id: this.opts.profileById }] : [],
      );
    }
    return Promise.resolve([]);
  }

  transaction<T>(cb: (tx: FakeDb) => Promise<T>): Promise<T> {
    return cb(this);
  }
}

const sub = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: 'active',
  created: 1_700_000_000,
  customer: `cus_${id}`,
  metadata: { supabase_user_id: 'u-meta' },
  items: {
    data: [{ price: { recurring: { interval: 'month', interval_count: 1 } } }],
  },
  current_period_start: 1_700_000_000,
  current_period_end: 1_702_000_000,
  ...extra,
});

/** Servicio con Stripe sustituido por listas en memoria por cuenta. */
class FakeService extends SubscriptionReconciliationService {
  constructor(
    db: FakeDb,
    private readonly byKey: Record<
      string,
      Array<ReturnType<typeof sub>> | Error
    >,
    private readonly customerEmail: string | null = null,
  ) {
    super(db as never);
  }

  public listedKeys: string[] = [];

  protected createStripe(secretKey: string) {
    this.listedKeys.push(secretKey);
    const data = this.byKey[secretKey];
    return {
      subscriptions: {
        list: () => {
          if (data instanceof Error) return Promise.reject(data);
          return Promise.resolve({ data: data ?? [], has_more: false });
        },
      },
      customers: {
        retrieve: () => Promise.resolve({ email: this.customerEmail }),
      },
    } as never;
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

describe('Pass-2 multi-cuenta', () => {
  it('barre las dos cuentas y no reporta nada cuando todo está en BD', async () => {
    const db = new FakeDb({ subsInDb: ['sub_m', 'sub_n'] });
    const svc = new FakeService(db, {
      sk_manuel: [sub('sub_m')],
      sk_nila: [sub('sub_n')],
    });

    const r = await svc.run(false);

    expect(svc.listedKeys.sort()).toEqual(['sk_manuel', 'sk_nila']);
    expect(r.pass2.stripeMissingInDb).toBe(0);
    expect(r.pass2.degraded).toBe(false);
    expect(r.pass2.accounts?.map((a) => [a.account, a.subsScanned])).toEqual([
      ['manuel', 1],
      ['nila', 1],
    ]);
    expect(db.writes).toHaveLength(0);
  });

  it('rescata la sub de Nila que falta en BD y etiqueta la cuenta', async () => {
    const db = new FakeDb({
      subsInDb: [],
      profileById: 'u-meta',
      profileState: {
        id: 'u-meta',
        email: 'ana@example.com',
        plan_type: 'free',
        stripe_customer_id: 'cus_viejo_manuel',
        payment_account: 'manuel',
      },
    });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [sub('sub_n')] });

    const r = await svc.run(false);

    expect(r.pass2.stripeMissingInDb).toBe(1);
    expect(r.pass2.stripeMissingFixed).toBe(1);
    expect(r.pass2.sample?.[0]).toMatchObject({
      account: 'nila',
      matchedBy: 'metadata',
    });
  });

  it('el rescate deja el perfil COHERENTE: premium + customer nuevo + cuenta nila', async () => {
    // Medio-arreglo a evitar: premium sí, pero payment_account='manuel' →
    // cancelar/portal/reembolso resolverían la cuenta equivocada.
    const db = new FakeDb({
      subsInDb: [],
      profileById: 'u-meta',
      profileState: {
        id: 'u-meta',
        email: 'ana@example.com',
        plan_type: 'free',
        stripe_customer_id: 'cus_viejo_manuel',
        payment_account: 'manuel',
      },
    });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [sub('sub_n')] });

    await svc.run(false);

    const update = db.writes.find((w) => /UPDATE user_profiles SET/i.test(w));
    expect(update).toBeDefined();
    expect(update).toContain('premium');
    expect(update).toContain('cus_sub_n');
    expect(update).toContain('nila');
  });

  it('encuentra al re-comprador por metadata aunque el customer del perfil sea el viejo', async () => {
    // Sin match por customer_id (el webhook nunca llegó a actualizarlo) y sin
    // match por email: solo la metadata de la sub identifica al usuario.
    const db = new FakeDb({
      subsInDb: [],
      profileById: 'u-meta',
      profileByCustomer: null,
      profileByEmail: null,
      profileState: {
        id: 'u-meta',
        email: 'ana@example.com',
        plan_type: 'free',
        stripe_customer_id: 'cus_viejo_manuel',
        payment_account: 'manuel',
      },
    });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [sub('sub_n')] });

    const r = await svc.run(false);

    expect(r.pass2.stripeMissingFixed).toBe(1);
    expect(r.pass2.sample?.[0].matchedBy).toBe('metadata');
  });

  it('guarda el plan REAL (semestral ya no se degrada a mensual)', async () => {
    const db = new FakeDb({
      subsInDb: [],
      profileById: 'u-meta',
      profileState: {
        id: 'u-meta',
        email: 'ana@example.com',
        plan_type: 'free',
        stripe_customer_id: 'cus_sub_n',
        payment_account: 'nila',
      },
    });
    const semestral = sub('sub_n', {
      items: {
        data: [
          { price: { recurring: { interval: 'month', interval_count: 6 } } },
        ],
      },
    });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [semestral] });

    await svc.run(false);

    const insert = db.writes.find((w) =>
      /INSERT INTO user_subscriptions/i.test(w),
    );
    expect(insert).toContain('premium_semester');
  });

  it('dryRun detecta pero NO escribe', async () => {
    const db = new FakeDb({ subsInDb: [], profileById: 'u-meta' });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [sub('sub_n')] });

    const r = await svc.run(true);

    expect(r.pass2.stripeMissingInDb).toBe(1);
    expect(r.pass2.stripeMissingFixed).toBe(0);
    expect(db.writes).toHaveLength(0);
  });

  it('una sub sin usuario identificable se reporta, no se inventa dueño', async () => {
    const db = new FakeDb({
      subsInDb: [],
      profileById: null,
      profileByCustomer: null,
      profileByEmail: null,
    });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [sub('sub_n')] });

    const r = await svc.run(false);

    expect(r.pass2.stripeMissingInDb).toBe(1);
    expect(r.pass2.stripeMissingFixed).toBe(0);
    expect(db.writes).toHaveLength(0);
    expect(r.pass2.sample?.[0]).toMatchObject({
      userId: null,
      matchedBy: null,
    });
  });

  it('cuenta sin secret key → degraded, y la otra se reconcilia igual', async () => {
    delete process.env.STRIPE_SECRET_KEY_NILA;
    const db = new FakeDb({ subsInDb: ['sub_m'] });
    const svc = new FakeService(db, { sk_manuel: [sub('sub_m')] });

    const r = await svc.run(false);

    expect(r.pass2.degraded).toBe(true);
    expect(r.pass2.accounts?.find((a) => a.account === 'nila')).toMatchObject({
      readable: false,
    });
    expect(r.pass2.accounts?.find((a) => a.account === 'manuel')).toMatchObject(
      {
        readable: true,
        subsScanned: 1,
      },
    );
  });

  it('un error de la API de una cuenta no tumba la otra', async () => {
    const db = new FakeDb({ subsInDb: ['sub_n'] });
    const svc = new FakeService(db, {
      sk_manuel: new Error('Invalid API Key'),
      sk_nila: [sub('sub_n')],
    });

    const r = await svc.run(false);

    expect(r.pass2.degraded).toBe(true);
    expect(r.pass2.errors.join()).toContain('Invalid API Key');
    expect(r.pass2.accounts?.find((a) => a.account === 'nila')).toMatchObject({
      readable: true,
    });
  });

  it('sin ninguna cuenta configurada, Pass-2 se salta y lo dice', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY_NILA;
    const db = new FakeDb({});
    const svc = new FakeService(db, {});

    const r = await svc.run(false);

    expect(r.pass2.errors).toContain('no_stripe_key');
    expect(r.pass2.degraded).toBe(true);
  });
});
