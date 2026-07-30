import { EMAIL_HISTORY_QUERY } from './email-policy';
import type { AlertRule } from './alert-rules';
import type { AlertNotification } from './notification-adapter';

/**
 * Cableado del motor ↔ política de email ↔ transporte (T-272).
 *
 * El núcleo puro (`email-policy.ts`) tiene sus 29 tests, pero unos tests verdes
 * sobre un núcleo que nadie llama son un falso verde — el repo ya se comió ese
 * fallo con el canario de purga ISR (pasaba con la llamada al daemon comentada).
 * Aquí se ejercita el `AlertsCron` REAL con un catálogo de reglas de mentira, y
 * se comprueba lo que un grep del fuente no puede:
 *
 *   · un incidente que enciende varias reglas manda UN correo, no N;
 *   · el aviso que no llega al buzón SIGUE registrándose, con el motivo;
 *   · el silencio queda medido en el `cron_run`.
 */

// Catálogo falso: el real tiene 74 reglas y cada una querría su propio fixture.
const REGLA_CRITICA: AlertRule = {
  name: 'fake_critica',
  severity: 'critical',
  query: { queryChunks: ['fake_critica'] } as never,
  shouldFire: () => true,
  buildNotification: () => ({
    title: 'algo crítico',
    body: 'cuerpo',
    fingerprint: 'fp_critica',
  }),
  cooldownMin: 0,
};

const REGLA_CRITICA_2: AlertRule = {
  ...REGLA_CRITICA,
  name: 'fake_critica_2',
  buildNotification: () => ({
    title: 'otra cosa crítica del mismo incidente',
    body: 'cuerpo',
    fingerprint: 'fp_critica_2',
  }),
};

const REGLA_ERROR: AlertRule = {
  ...REGLA_CRITICA,
  name: 'fake_error',
  severity: 'error',
  buildNotification: () => ({
    title: 'un error',
    body: 'cuerpo',
    fingerprint: 'fp_error',
  }),
};

const REGLA_ERROR_SIEMPRE: AlertRule = {
  ...REGLA_ERROR,
  name: 'fake_error_siempre',
  emailAlways: true,
  buildNotification: () => ({
    title: 'un error que bloquea a todo el mundo',
    body: 'cuerpo',
    fingerprint: 'fp_error_siempre',
  }),
};

const REGLA_MUDA: AlertRule = {
  ...REGLA_CRITICA,
  name: 'fake_no_dispara',
  shouldFire: () => false,
};

let CATALOGO: AlertRule[] = [];
jest.mock('./alert-rules', () => ({
  get ALERT_RULES() {
    return CATALOGO;
  },
}));

const { AlertsCron } = require('./alerts.cron') as {
  AlertsCron: new (...args: never[]) => { [k: string]: never };
};

interface Emitido {
  eventType: string;
  severity: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
}

function montar(opts: { historial?: unknown[] } = {}) {
  const enviados: AlertNotification[][] = [];
  const emitidos: Emitido[] = [];

  const execute = jest.fn(async (q: unknown) => {
    if (q === EMAIL_HISTORY_QUERY) return opts.historial ?? [];
    return [];
  });

  const cron = new AlertsCron(
    { execute } as never,
    { execute } as never,
    {
      send: jest.fn(async (n: AlertNotification[]) => {
        enviados.push(n);
      }),
    } as never,
    {
      emitFireAndForget: (e: Emitido) => emitidos.push(e),
    } as never,
    {} as never,
    {
      register: () => undefined,
      getProcessStartedAtMs: () => Date.now() - 86_400_000,
    } as never,
  );

  return {
    correr: () => (cron as unknown as { runImpl(): Promise<void> }).runImpl(),
    enviados,
    emitidos,
    disparos: () => emitidos.filter((e) => e.eventType === 'alert_fired'),
    run: () => emitidos.find((e) => e.eventType === 'cron_run'),
  };
}

describe('AlertsCron ↔ política de email: cableado real (T-272)', () => {
  const ENV = process.env.ALERT_EMAIL_MIN_SEVERITY;
  afterEach(() => {
    if (ENV === undefined) delete process.env.ALERT_EMAIL_MIN_SEVERITY;
    else process.env.ALERT_EMAIL_MIN_SEVERITY = ENV;
    jest.resetModules();
  });

  it('un incidente que enciende varias reglas manda UN correo, no N', async () => {
    CATALOGO = [REGLA_CRITICA, REGLA_CRITICA_2];
    const t = montar();
    await t.correr();

    expect(t.enviados).toHaveLength(1); // un solo envío…
    expect(t.enviados[0]).toHaveLength(2); // …con los dos avisos dentro
    expect(t.enviados[0].map((n) => n.rule).sort()).toEqual([
      'fake_critica',
      'fake_critica_2',
    ]);
  });

  it('sin nada que avisar no se toca el canal', async () => {
    CATALOGO = [REGLA_MUDA];
    const t = montar();
    await t.correr();
    expect(t.enviados).toHaveLength(0);
    expect(t.disparos()).toHaveLength(0);
  });

  it('el aviso que NO va al buzón se registra igual, con el motivo', async () => {
    // Es la invariante de T-162: si se suprimiera la señal en vez del correo, el
    // panel dejaría de ver que el problema sigue vivo.
    CATALOGO = [REGLA_ERROR];
    const t = montar();
    await t.correr();

    expect(t.enviados).toHaveLength(0);
    const disparos = t.disparos();
    expect(disparos).toHaveLength(1);
    expect(disparos[0].metadata).toMatchObject({
      rule: 'fake_error',
      emailed: false,
      emailSkipped: 'severity',
    });
  });

  it('el aviso que SÍ va al buzón queda marcado como emaileado', async () => {
    CATALOGO = [REGLA_CRITICA];
    const t = montar();
    await t.correr();
    expect(t.disparos()[0].metadata).toMatchObject({
      rule: 'fake_critica',
      emailed: true,
      emailSkipped: null,
    });
  });

  it('emailAlways deja pasar una regla por debajo del mínimo', async () => {
    CATALOGO = [REGLA_ERROR, REGLA_ERROR_SIEMPRE];
    const t = montar();
    await t.correr();

    expect(t.enviados[0].map((n) => n.rule)).toEqual(['fake_error_siempre']);
  });

  it('la repetición reciente del mismo problema no manda correo (backoff)', async () => {
    CATALOGO = [REGLA_CRITICA];
    const t = montar({
      historial: [
        {
          rule: 'fake_critica',
          fingerprint: 'fp_critica',
          sentAt: [new Date(Date.now() - 5 * 60_000)],
        },
      ],
    });
    await t.correr();

    expect(t.enviados).toHaveLength(0);
    expect(t.disparos()[0].metadata).toMatchObject({
      emailed: false,
      emailSkipped: 'backoff',
      emailStreak: 1,
    });
    expect(t.disparos()[0].metadata?.emailNextInMin).toBeGreaterThan(0);
  });

  it('la env puede devolver el comportamiento anterior (todo al buzón)', async () => {
    process.env.ALERT_EMAIL_MIN_SEVERITY = 'warn';
    jest.resetModules();

    const { AlertsCron: Recargado } = require('./alerts.cron');
    const enviados: AlertNotification[][] = [];
    const execute = jest.fn(async () => []);
    CATALOGO = [REGLA_ERROR];
    const cron = new Recargado(
      { execute },
      { execute },
      { send: async (n: AlertNotification[]) => void enviados.push(n) },
      { emitFireAndForget: () => undefined },
      {},
      { register: () => undefined, getProcessStartedAtMs: () => Date.now() },
    );
    await (cron as { runImpl(): Promise<void> }).runImpl();

    expect(enviados).toHaveLength(1);
    expect(enviados[0][0].rule).toBe('fake_error');
  });

  it('el silencio del canal queda MEDIDO en el cron_run', async () => {
    // Sin estas cifras, "hoy me llegan menos correos" no se distingue de "el
    // canal está roto": el mismo modo de fallo que T-162.
    CATALOGO = [REGLA_CRITICA, REGLA_ERROR];
    const t = montar();
    await t.correr();

    expect(t.run()?.metadata).toMatchObject({
      emailsSent: 1,
      emailAlertsBatched: 1,
      emailsSkippedBySeverity: 1,
      emailsSkippedByBackoff: 0,
      emailMinSeverity: 'critical',
      emailHistoryHydrated: true,
    });
  });

  it('si el historial no se puede leer, se emailea (fail-open) y se dice', async () => {
    CATALOGO = [REGLA_CRITICA];
    const enviados: AlertNotification[][] = [];
    const emitidos: Emitido[] = [];
    const execute = jest.fn(async (q: unknown) => {
      if (q === EMAIL_HISTORY_QUERY) throw new Error('réplica caída');
      return [];
    });
    const cron = new AlertsCron(
      { execute } as never,
      { execute } as never,
      {
        send: async (n: AlertNotification[]) => void enviados.push(n),
      } as never,
      { emitFireAndForget: (e: Emitido) => emitidos.push(e) } as never,
      {} as never,
      {
        register: () => undefined,
        getProcessStartedAtMs: () => Date.now(),
      } as never,
    );
    await (cron as unknown as { runImpl(): Promise<void> }).runImpl();

    expect(enviados).toHaveLength(1);
    expect(
      emitidos.find((e) => e.eventType === 'cron_run')?.metadata,
    ).toMatchObject({ emailHistoryHydrated: false });
  });

  it('un fallo del canal deja SEÑAL, no solo un log', async () => {
    CATALOGO = [REGLA_CRITICA];
    const emitidos: Emitido[] = [];
    const execute = jest.fn(async () => []);
    const cron = new AlertsCron(
      { execute } as never,
      { execute } as never,
      {
        send: async () => {
          throw new Error('Resend 500');
        },
      } as never,
      { emitFireAndForget: (e: Emitido) => emitidos.push(e) } as never,
      {} as never,
      {
        register: () => undefined,
        getProcessStartedAtMs: () => Date.now(),
      } as never,
    );
    await (cron as unknown as { runImpl(): Promise<void> }).runImpl();

    const fallo = emitidos.find((e) => e.eventType === 'alert_email_failed');
    expect(fallo).toBeDefined();
    expect(fallo?.severity).toBe('error');
    expect(fallo?.metadata).toMatchObject({ avisos: 1 });
  });
});
