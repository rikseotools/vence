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
  /** Pass-3 (a): filas `active` en BD, con su sub y su email */
  filasActivas?: Array<{
    user_id: string;
    stripe_subscription_id: string;
    email: string | null;
  }>;
  /** Pass-3 (b): perfiles premium sin suscripción viva ni concesión */
  premiumSinSub?: Array<{ id: string; email: string | null }>;
  /** estado actual del perfil que se lee dentro de la transacción */
  profileState?: {
    id: string;
    email: string | null;
    plan_type: string | null;
    stripe_customer_id: string | null;
    payment_account: string | null;
  };
  /** Pass-1: filas user_subscriptions×user_profiles candidatas (T-295) */
  pass1Rows?: Array<{
    user_id: string;
    status: string;
    stripe_subscription_id: string;
    current_period_end: string | null;
    email: string;
    profile_plan_type: string;
  }>;
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
    if (/INNER JOIN user_profiles/i.test(text)) {
      return Promise.resolve(this.opts.pass1Rows ?? []);
    }
    // Pass-3 (a): filas active cuya sub ya no está activa en Stripe
    if (/JOIN user_profiles up ON up\.id = us\.user_id/i.test(text)) {
      return Promise.resolve(this.opts.filasActivas ?? []);
    }
    // Pass-3 (b): perfiles premium sin suscripción viva ni concesión declarada
    if (/plan_type = 'premium'/i.test(text)) {
      return Promise.resolve(this.opts.premiumSinSub ?? []);
    }
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
    /**
     * Qué contesta Stripe si se PREGUNTA por un id concreto (T-344). Clave: id de suscripción;
     * valor: su estado. Un id ausente = `resource_missing` en todas las cuentas, que es lo que
     * Stripe devuelve cuando el id no es de esa cuenta.
     */
    private readonly porId: Record<string, string> = {},
  ) {
    super(db as never);
  }

  /** Ids por los que se ha preguntado, para poder afirmar que NO se lista la cartera entera. */
  public retrievedIds: string[] = [];

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
        retrieve: (id: string) => {
          this.retrievedIds.push(id);
          const estado = this.porId[id];
          if (!estado) {
            const err = Object.assign(new Error('No such subscription'), {
              code: 'resource_missing',
              statusCode: 404,
            });
            return Promise.reject(err);
          }
          return Promise.resolve({ id, status: estado });
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

describe('Pass-1 — el HECHO manda sobre el status (T-295)', () => {
  it('caso real T-295: fila active con current_period_end vencido hace meses → NO se concede', async () => {
    const db = new FakeDb({
      pass1Rows: [
        {
          user_id: 'u-stale',
          status: 'active',
          stripe_subscription_id: 'sub_stale',
          current_period_end: '2026-05-27T00:00:00Z',
          email: 'cliente@example.com',
          profile_plan_type: 'free',
        },
      ],
    });
    const svc = new FakeService(db, {});

    const r = await svc.run(false);

    expect(r.pass1.detected).toBe(0);
    expect(r.pass1.fixed).toBe(0);
    expect(r.pass1.staleSinVigencia).toBe(1);
    expect(r.pass1.staleSample[0]).toMatchObject({
      user_id: 'u-stale',
      current_period_end: '2026-05-27T00:00:00Z',
    });
    // Y sobre todo: NINGÚN UPDATE user_profiles para ESTE usuario (Pass-3(b) query siempre
    // corre y también menciona "plan_type = 'premium'", así que hay que acotar por user_id).
    expect(
      db.queries.some(
        (q) => /UPDATE user_profiles/i.test(q) && q.includes('u-stale'),
      ),
    ).toBe(false);
  });

  it('fila active con current_period_end en el futuro → SÍ se concede (comportamiento previo intacto)', async () => {
    const futuro = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const db = new FakeDb({
      pass1Rows: [
        {
          user_id: 'u-vigente',
          status: 'active',
          stripe_subscription_id: 'sub_vigente',
          current_period_end: futuro,
          email: 'paga@example.com',
          profile_plan_type: 'free',
        },
      ],
    });
    const svc = new FakeService(db, {});

    const r = await svc.run(false);

    expect(r.pass1.detected).toBe(1);
    expect(r.pass1.fixed).toBe(1);
    expect(r.pass1.staleSinVigencia).toBe(0);
    expect(
      db.queries.some(
        (q) => /UPDATE user_profiles/i.test(q) && q.includes('u-vigente'),
      ),
    ).toBe(true);
  });

  it('fila active SIN current_period_end (dato incompleto) → se respeta el status, se concede', async () => {
    const db = new FakeDb({
      pass1Rows: [
        {
          user_id: 'u-sin-fecha',
          status: 'trialing',
          stripe_subscription_id: 'sub_sin_fecha',
          current_period_end: null,
          email: 'trial@example.com',
          profile_plan_type: 'free',
        },
      ],
    });
    const svc = new FakeService(db, {});

    const r = await svc.run(false);

    expect(r.pass1.detected).toBe(1);
    expect(r.pass1.staleSinVigencia).toBe(0);
  });

  it('mezcla: una fila vigente se concede y una vencida no, en la misma pasada', async () => {
    const futuro = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
    const db = new FakeDb({
      pass1Rows: [
        {
          user_id: 'u-ok',
          status: 'active',
          stripe_subscription_id: 'sub_ok',
          current_period_end: futuro,
          email: 'ok@example.com',
          profile_plan_type: 'free',
        },
        {
          user_id: 'u-stale-2',
          status: 'past_due',
          stripe_subscription_id: 'sub_stale_2',
          current_period_end: '2026-01-01T00:00:00Z',
          email: 'viejo@example.com',
          profile_plan_type: 'free',
        },
      ],
    });
    const svc = new FakeService(db, {});

    const r = await svc.run(false);

    expect(r.pass1.detected).toBe(1);
    expect(r.pass1.fixed).toBe(1);
    expect(r.pass1.sample[0].user_id).toBe('u-ok');
    expect(r.pass1.staleSinVigencia).toBe(1);
    expect(r.pass1.staleSample[0].user_id).toBe('u-stale-2');
  });
});

describe('Pass-3 — premium sin respaldo (la dirección que nadie vigilaba)', () => {
  it('caza la fila active cuya suscripción ya NO está activa en Stripe', async () => {
    // El caso real del 29/07: canceló el 26/05, Stripe la terminó el 27/05, la fila se quedó
    // en active y el perfil en premium — dos meses de premium regalado.
    const db = new FakeDb({
      subsInDb: ['sub_viva'],
      filasActivas: [
        {
          user_id: 'u-fuga',
          stripe_subscription_id: 'sub_muerta',
          email: 'ana@example.com',
        },
        {
          user_id: 'u-ok',
          stripe_subscription_id: 'sub_viva',
          email: 'bea@example.com',
        },
      ],
    });
    const svc = new FakeService(
      db,
      { sk_manuel: [sub('sub_viva')], sk_nila: [] },
      null,
      // Stripe confirma que esa sí está cancelada de verdad (T-344: ya no basta con «no salía
      // en la lista»; hay que preguntar por ella).
      { sub_muerta: 'canceled' },
    );

    const r = await svc.run(false);

    expect(r.pass2.sinRespaldo).toEqual([
      {
        userId: 'u-fuga',
        email: 'ana@example.com',
        motivo: 'fila_active_sin_sub_en_stripe',
        subscriptionId: 'sub_muerta',
        estadoEnStripe: 'canceled',
      },
    ]);
    // Y se preguntó SOLO por el sospechoso, no por la cartera.
    expect(svc.retrievedIds).toEqual(['sub_muerta']);
  });

  // ── LA REGRESIÓN DE T-344 (30/07/2026) ──────────────────────────────────────────────────
  // El Pase 2 lista Stripe con `created: { gte: 30 días }`, así que una suscripción más antigua
  // NO aparece en esa lista aunque esté viva. Antes eso bastaba para acusar a su dueño: medido en
  // producción, **159 clientes que pagaban, cada hora**. Y lo caro no era el ruido — este detector
  // vigila fuga de premium, o sea dinero, y con 159 falsos la fuga real quedaba enterrada.
  it('NO acusa a la suscripción ANTIGUA que sigue viva (no salía en la lista de 30 días)', async () => {
    const db = new FakeDb({
      subsInDb: ['sub_vieja'],
      filasActivas: [
        {
          user_id: 'u-veterano',
          stripe_subscription_id: 'sub_vieja',
          email: 'ana.veterana@example.com',
        },
      ],
    });
    const svc = new FakeService(
      db,
      // La lista de los últimos 30 días NO la incluye: es de hace 156 días.
      { sk_manuel: [], sk_nila: [] },
      null,
      { sub_vieja: 'active' },
    );

    const r = await svc.run(false);

    expect(r.pass2.sinRespaldo).toEqual([]);
    expect(svc.retrievedIds).toEqual(['sub_vieja']);
  });

  it('tampoco acusa a la que está en `past_due`: es un cobro fallado, no una fuga', async () => {
    const db = new FakeDb({
      subsInDb: ['sub_impagada'],
      filasActivas: [
        {
          user_id: 'u-impago',
          stripe_subscription_id: 'sub_impagada',
          email: 'dani@example.com',
        },
      ],
    });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [] }, null, {
      sub_impagada: 'past_due',
    });

    expect((await svc.run(false)).pass2.sinRespaldo).toEqual([]);
  });

  it('si Stripe no se puede consultar, NO acusa (ante la duda, callar)', async () => {
    // Un fallo de red o de credenciales no es prueba de fuga. Acusar aquí es decirle a alguien
    // que paga que no paga, y eso no se hace con una hipótesis.
    const db = new FakeDb({
      subsInDb: [],
      filasActivas: [
        {
          user_id: 'u-dudoso',
          stripe_subscription_id: 'sub_incognita',
          email: 'eva@example.com',
        },
      ],
    });
    class Caida extends FakeService {
      protected createStripe() {
        return {
          subscriptions: {
            list: () => Promise.resolve({ data: [], has_more: false }),
            retrieve: () => Promise.reject(new Error('connection reset')),
          },
        } as never;
      }
    }
    const svc = new Caida(db, { sk_manuel: [], sk_nila: [] });

    expect((await svc.run(false)).pass2.sinRespaldo).toEqual([]);
  });

  it('caza el perfil premium sin suscripción ni concesión declarada', async () => {
    const db = new FakeDb({
      subsInDb: ['sub_viva'],
      premiumSinSub: [{ id: 'u-regalado', email: 'cris@example.com' }],
    });
    const svc = new FakeService(db, {
      sk_manuel: [sub('sub_viva')],
      sk_nila: [],
    });

    const r = await svc.run(false);

    expect(r.pass2.sinRespaldo).toEqual([
      {
        userId: 'u-regalado',
        email: 'cris@example.com',
        motivo: 'premium_sin_suscripcion_ni_concesion',
        subscriptionId: null,
      },
    ]);
  });

  it('NO acusa a nadie si alguna cuenta Stripe es ilegible', async () => {
    // Con una cuenta ciega, una suscripción viva de ESA cuenta parecería inexistente y
    // acusaríamos de fuga a un cliente que sí paga. Mejor no mirar que mirar mal.
    delete process.env.STRIPE_SECRET_KEY_NILA;
    const db = new FakeDb({
      subsInDb: [],
      filasActivas: [
        { user_id: 'u-x', stripe_subscription_id: 'sub_de_nila', email: null },
      ],
    });
    const svc = new FakeService(db, { sk_manuel: [] });

    const r = await svc.run(false);

    expect(r.pass2.degraded).toBe(true);
    expect(r.pass2.sinRespaldo).toEqual([]);
  });

  it('SOLO detecta: no escribe nada aunque encuentre fugas', async () => {
    // Quitar premium afecta a una persona real y puede tener una razón que no está en la BD.
    const db = new FakeDb({
      subsInDb: [],
      premiumSinSub: [{ id: 'u-regalado', email: null }],
    });
    const svc = new FakeService(db, { sk_manuel: [], sk_nila: [] });

    await svc.run(false);

    expect(db.writes).toHaveLength(0);
  });
});
